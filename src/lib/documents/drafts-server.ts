import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { COMPOSE_LIMITS, normalizeFieldValues, type DocumentDraft, type DocumentStatus, type FieldValues } from "./compose";
import { isDocumentType, type DocumentTemplate, type DocumentType } from "./templates";
import { loadDocumentTemplate } from "./templates-server";

const COLUMNS = "id, template_id, type, title, field_values, status, created_by, created_at, updated_at";

type DocumentRow = {
  id: string;
  template_id: string;
  type: string;
  title: string;
  field_values: unknown;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function toFieldValues(raw: unknown): FieldValues {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
}

function mapRow(row: DocumentRow, names: Map<string, string>): DocumentDraft {
  return {
    id: row.id,
    templateId: row.template_id,
    type: isDocumentType(row.type) ? row.type : "quyet_dinh",
    title: row.title,
    fieldValues: toFieldValues(row.field_values),
    status: (row.status === "da_ban_hanh" ? "da_ban_hanh" : "nhap") as DocumentStatus,
    createdBy: row.created_by,
    createdByName: (row.created_by && names.get(row.created_by)) || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadNames(db: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const { data } = await db.from(CDILV_TABLE.profiles).select("id, full_name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
}

async function mapRows(db: SupabaseClient, rows: DocumentRow[]): Promise<DocumentDraft[]> {
  const names = await loadNames(db, rows.map((r) => r.created_by));
  return rows.map((r) => mapRow(r, names));
}

/** Bản nháp (status = 'nhap'), mới sửa lên trước. */
export async function loadDocumentDrafts(db: SupabaseClient): Promise<DocumentDraft[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.documents)
    .select(COLUMNS)
    .eq("status", "nhap")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Không tải được bản nháp: ${error.message}`);
  return mapRows(db, (data ?? []) as DocumentRow[]);
}

export async function countDocumentDrafts(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from(CDILV_TABLE.documents)
    .select("id", { count: "exact", head: true })
    .eq("status", "nhap");
  if (error) throw new Error(`Không tải được bản nháp: ${error.message}`);
  return count ?? 0;
}

export type DraftInput = { template: DocumentTemplate; title: string; values: FieldValues };

/**
 * Kiểm tra dữ liệu gửi lên { templateId, title, values }: mẫu phải tồn tại; mẫu mới chọn phải đang dùng
 * (allowInactiveId: mẫu cũ của bản nháp được mở lại, vẫn dùng tiếp dù đã ngừng dùng).
 */
export async function parseDraftInput(
  db: SupabaseClient,
  raw: unknown,
  allowInactiveId: string | null = null,
): Promise<{ value: DraftInput; error: null } | { value: null; error: string }> {
  if (!raw || typeof raw !== "object") return { value: null, error: "Dữ liệu không hợp lệ." };
  const body = raw as Record<string, unknown>;
  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(templateId)) {
    return { value: null, error: "Vui lòng chọn mẫu văn bản." };
  }
  const template = await loadDocumentTemplate(db, templateId);
  if (!template) return { value: null, error: "Không tìm thấy mẫu văn bản." };
  if (!template.isActive && template.id !== allowInactiveId) {
    return { value: null, error: "Mẫu văn bản này đã ngừng dùng." };
  }
  const title = typeof body.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
  if (!title) return { value: null, error: "Vui lòng nhập tiêu đề văn bản." };
  if (title.length > COMPOSE_LIMITS.title) return { value: null, error: "Tiêu đề quá dài." };
  return { value: { template, title, values: normalizeFieldValues(template.fields, body.values) }, error: null };
}

export async function loadDocumentDraft(db: SupabaseClient, id: string): Promise<DocumentDraft | null> {
  const { data, error } = await db.from(CDILV_TABLE.documents).select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Không tải được văn bản: ${error.message}`);
  if (!data) return null;
  return (await mapRows(db, [data as DocumentRow]))[0];
}

function rowValues(input: DraftInput): { template_id: string; type: DocumentType; title: string; field_values: FieldValues } {
  return { template_id: input.template.id, type: input.template.docType, title: input.title, field_values: input.values };
}

export async function insertDocumentDraft(db: SupabaseClient, input: DraftInput, actorId: string): Promise<DocumentDraft> {
  const { data, error } = await db
    .from(CDILV_TABLE.documents)
    .insert({ ...rowValues(input), status: "nhap", created_by: actorId })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`Không lưu được bản nháp: ${error.message}`);
  return (await mapRows(db, [data as DocumentRow]))[0];
}

/** Chỉ sửa được khi còn là bản nháp. */
export async function updateDocumentDraft(db: SupabaseClient, id: string, input: DraftInput): Promise<DocumentDraft | null> {
  const { data, error } = await db
    .from(CDILV_TABLE.documents)
    .update({ ...rowValues(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "nhap")
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`Không lưu được bản nháp: ${error.message}`);
  return data ? (await mapRows(db, [data as DocumentRow]))[0] : null;
}

/** Chỉ xóa được khi còn là bản nháp. Trả về false nếu không có bản nháp nào bị xóa. */
export async function deleteDocumentDraft(db: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from(CDILV_TABLE.documents)
    .delete()
    .eq("id", id)
    .eq("status", "nhap")
    .select("id");
  if (error) throw new Error(`Không xóa được bản nháp: ${error.message}`);
  return (data ?? []).length > 0;
}
