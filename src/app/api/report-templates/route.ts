import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import {
  TEMPLATE_LIMITS,
  isItemCode,
  parseTemplateLines,
  validateTemplateLines,
  type TemplateLine,
} from "@/lib/report-templates/registry";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LINE_COLUMNS = "side, code, label, line_type, parent_code, sum_codes, sort_order";

type Db = ReturnType<typeof createServiceClient>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

async function loadDraft(db: Db, versionId: string) {
  const { data, error } = await db
    .from(CDILV_TABLE.reportTemplateVersions)
    .select("id, template_id, status")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw error;
  return data && data.status === "draft" ? data : null;
}

async function loadLines(db: Db, versionId: string): Promise<TemplateLine[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.reportTemplateLines)
    .select(LINE_COLUMNS)
    .eq("version_id", versionId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as TemplateLine[];
}

/**
 * Mẫu báo cáo dùng chung cho mọi đơn vị (chỉ Quản trị viên). Body:
 *  { action: "createDraft", templateId }                       – sao chép phiên bản đang áp dụng thành bản nháp mới
 *  { action: "saveDraft", versionId, title, note, lines[] }    – lưu bản nháp
 *  { action: "discardDraft", versionId }                       – hủy bản nháp
 *  { action: "publish", versionId, effectiveFrom, note }       – áp dụng bản nháp (bản cũ chuyển sang "đã thay thế")
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard.response) return guard.response;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = createServiceClient();
    const now = new Date().toISOString();

    if (body.action === "createDraft") {
      const templateId = uuid(body.templateId);
      if (!templateId) return bad("Mẫu báo cáo không hợp lệ.");
      const { data: versions, error } = await db
        .from(CDILV_TABLE.reportTemplateVersions)
        .select("id, version, status, title, note")
        .eq("template_id", templateId)
        .order("version", { ascending: false });
      if (error) throw error;
      if (!versions?.length) return bad("Không tìm thấy mẫu báo cáo.", 404);
      if (versions.some((v) => v.status === "draft")) return bad("Mẫu này đang có một bản nháp – hãy sửa tiếp hoặc hủy bản nháp đó.", 409);
      const active = versions.find((v) => v.status === "active") ?? versions[0];
      const lines = await loadLines(db, active.id);

      const { data: created, error: insertError } = await db
        .from(CDILV_TABLE.reportTemplateVersions)
        .insert({
          template_id: templateId,
          version: versions[0].version + 1,
          status: "draft",
          title: active.title,
          note: null,
          created_by: guard.access.userId,
        })
        .select("id")
        .single();
      if (insertError) {
        if (insertError.code === "23505") return bad("Mẫu này đang có một bản nháp.", 409);
        throw insertError;
      }
      if (lines.length) {
        const { error: linesError } = await db
          .from(CDILV_TABLE.reportTemplateLines)
          .insert(lines.map((l) => ({ ...l, version_id: created.id })));
        if (linesError) throw linesError;
      }
      return NextResponse.json({ ok: true, versionId: created.id });
    }

    if (body.action === "saveDraft") {
      const versionId = uuid(body.versionId);
      if (!versionId) return bad("Phiên bản không hợp lệ.");
      const title = text(body.title);
      const note = text(body.note) || null;
      if (!title || title.length > TEMPLATE_LIMITS.title) return bad("Tên phiên bản không hợp lệ.");
      if ((note?.length ?? 0) > TEMPLATE_LIMITS.note) return bad(`Ghi chú tối đa ${TEMPLATE_LIMITS.note} ký tự.`);
      const lines = parseTemplateLines(body.lines);
      const errors = validateTemplateLines(lines);
      if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });
      if (!(await loadDraft(db, versionId))) return bad("Chỉ sửa được bản nháp.", 409);

      const { error: deleteError } = await db.from(CDILV_TABLE.reportTemplateLines).delete().eq("version_id", versionId);
      if (deleteError) throw deleteError;
      const { error: linesError } = await db
        .from(CDILV_TABLE.reportTemplateLines)
        .insert(lines.map((l) => ({ ...l, version_id: versionId })));
      if (linesError) throw linesError;
      const { error } = await db
        .from(CDILV_TABLE.reportTemplateVersions)
        .update({ title, note, updated_at: now })
        .eq("id", versionId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "discardDraft") {
      const versionId = uuid(body.versionId);
      if (!versionId || !(await loadDraft(db, versionId))) return bad("Không tìm thấy bản nháp.", 404);
      const { error } = await db.from(CDILV_TABLE.reportTemplateVersions).delete().eq("id", versionId).eq("status", "draft");
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "publish") {
      const versionId = uuid(body.versionId);
      const effectiveFrom = text(body.effectiveFrom);
      const note = text(body.note) || null;
      if (!versionId) return bad("Phiên bản không hợp lệ.");
      if (!DATE_RE.test(effectiveFrom)) return bad("Vui lòng chọn ngày bắt đầu áp dụng.");
      if ((note?.length ?? 0) > TEMPLATE_LIMITS.note) return bad(`Ghi chú tối đa ${TEMPLATE_LIMITS.note} ký tự.`);
      if (!(await loadDraft(db, versionId))) return bad("Chỉ áp dụng được bản nháp.", 409);
      const lines = await loadLines(db, versionId);
      const errors = validateTemplateLines(lines);
      if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });

      const { error } = await db.rpc(CDILV_RPC.reportTemplatePublish, {
        p_version_id: versionId,
        p_actor_id: guard.access.userId,
        p_effective_from: effectiveFrom,
        p_note: note,
      });
      if (error) {
        if (error.code === "P0001") return bad(error.message, 409);
        throw error;
      }

      const { data: categories, error: catError } = await db
        .from(CDILV_TABLE.fundCategories)
        .select("kind, name, report_group")
        .eq("is_active", true);
      if (catError) throw catError;
      const orphaned = (categories ?? [])
        .filter((c) => !isItemCode(lines, c.kind, c.report_group))
        .map((c) => c.name as string);
      return NextResponse.json({ ok: true, orphaned });
    }

    return bad("Thao tác không hợp lệ.");
  } catch (error) {
    console.error("[report-templates]", error);
    return bad("Không lưu được mẫu báo cáo. Vui lòng thử lại.", 500);
  }
}
