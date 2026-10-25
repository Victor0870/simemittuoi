import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { describeFieldErrors, documentFileName, layoutDocument, validateFieldValues } from "@/lib/documents/compose";
import { buildDocumentDocx } from "@/lib/documents/docx-server";
import { loadDocumentDraft, parseDraftInput } from "@/lib/documents/drafts-server";
import { loadDocumentOrgSettings } from "@/lib/documents/settings-server";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Xuất .docx từ mẫu + giá trị form. Body: { templateId, title, values, draftId? }.
 * Nội dung mẫu và cài đặt đơn vị đọc từ CSDL; trường bắt buộc phải nhập đủ.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;

    const db = createServiceClient();
    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const draftId = typeof raw?.draftId === "string" && UUID_RE.test(raw.draftId) ? raw.draftId : null;
    const draft = draftId ? await loadDocumentDraft(db, draftId) : null;

    const parsed = await parseDraftInput(db, raw, draft?.templateId ?? null);
    if (parsed.error !== null) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { template, title, values } = parsed.value;

    const errors = validateFieldValues(template.fields, values);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: `Chưa nhập đúng / đủ: ${describeFieldErrors(template.fields, errors)}.`, fields: errors },
        { status: 400 },
      );
    }

    const settings = await loadDocumentOrgSettings(db);
    const layout = layoutDocument(template.body, template.fields, values, settings);
    const buffer = await buildDocumentDocx(layout, title);
    const fileName = documentFileName(template.docType, title, values);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[api/documents/export] POST error:", err);
    return NextResponse.json({ error: "Không xuất được file Word." }, { status: 500 });
  }
}
