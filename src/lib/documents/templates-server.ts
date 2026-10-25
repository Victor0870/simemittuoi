import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import {
  DOCUMENT_TEMPLATE_LIMITS,
  DOCUMENT_TYPES,
  isDocumentType,
  parseTemplateFields,
  type DocumentTemplate,
  type DocumentType,
  type TemplateField,
} from "./templates";

const COLUMNS = "id, name, doc_type, body, fields, is_active, created_at, updated_at";

type TemplateRow = {
  id: string;
  name: string;
  doc_type: string;
  body: string | null;
  fields: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function mapRow(row: TemplateRow): DocumentTemplate {
  return {
    id: row.id,
    name: row.name,
    docType: isDocumentType(row.doc_type) ? row.doc_type : "quyet_dinh",
    body: row.body ?? "",
    fields: parseTemplateFields(row.fields).fields,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Mọi mẫu (kể cả đã ngừng dùng), xếp theo loại rồi theo tên. */
export async function loadDocumentTemplates(db: SupabaseClient): Promise<DocumentTemplate[]> {
  const { data, error } = await db.from(CDILV_TABLE.documentTemplates).select(COLUMNS).limit(2000);
  if (error) throw new Error(`Không tải được mẫu văn bản: ${error.message}`);
  return ((data ?? []) as TemplateRow[])
    .map(mapRow)
    .sort(
      (a, b) =>
        DOCUMENT_TYPES.indexOf(a.docType) - DOCUMENT_TYPES.indexOf(b.docType) ||
        a.name.localeCompare(b.name, "vi", { numeric: true, sensitivity: "base" }),
    );
}

export async function loadDocumentTemplate(db: SupabaseClient, id: string): Promise<DocumentTemplate | null> {
  const { data, error } = await db.from(CDILV_TABLE.documentTemplates).select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Không tải được mẫu văn bản: ${error.message}`);
  return data ? mapRow(data as TemplateRow) : null;
}

export async function countDocumentTemplates(db: SupabaseClient): Promise<{ total: number; active: number }> {
  const { data, error } = await db.from(CDILV_TABLE.documentTemplates).select("is_active").limit(2000);
  if (error) throw new Error(`Không tải được mẫu văn bản: ${error.message}`);
  const rows = (data ?? []) as { is_active: boolean }[];
  return { total: rows.length, active: rows.filter((r) => r.is_active).length };
}

export type DocumentTemplateInput = {
  name?: string;
  doc_type?: DocumentType;
  body?: string;
  fields?: TemplateField[];
  is_active?: boolean;
};

/**
 * Kiểm tra dữ liệu gửi lên. partial = true (sửa): chỉ kiểm tra các khóa có mặt;
 * partial = false (tạo mới): bắt buộc tên và loại.
 */
export function parseDocumentTemplateInput(
  raw: unknown,
  partial: boolean,
): { value: DocumentTemplateInput; error: null } | { value: null; error: string } {
  if (!raw || typeof raw !== "object") return { value: null, error: "Dữ liệu không hợp lệ." };
  const body = raw as Record<string, unknown>;
  const value: DocumentTemplateInput = {};

  if (!partial || "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (!name) return { value: null, error: "Vui lòng nhập tên mẫu." };
    if (name.length > DOCUMENT_TEMPLATE_LIMITS.name) return { value: null, error: "Tên mẫu quá dài." };
    value.name = name;
  }
  if (!partial || "docType" in body) {
    if (!isDocumentType(body.docType)) return { value: null, error: "Vui lòng chọn loại văn bản." };
    value.doc_type = body.docType;
  }
  if (!partial || "body" in body) {
    const text = typeof body.body === "string" ? body.body.replace(/\r\n/g, "\n") : "";
    if (text.length > DOCUMENT_TEMPLATE_LIMITS.body) return { value: null, error: "Nội dung mẫu quá dài." };
    value.body = text;
  }
  if (!partial || "fields" in body) {
    const parsed = parseTemplateFields(body.fields ?? []);
    if (parsed.error) return { value: null, error: parsed.error };
    value.fields = parsed.fields;
  }
  if (!partial || "isActive" in body) {
    if (partial && typeof body.isActive !== "boolean") return { value: null, error: "Trạng thái không hợp lệ." };
    value.is_active = body.isActive !== false;
  }
  if (partial && Object.keys(value).length === 0) return { value: null, error: "Không có gì để cập nhật." };
  return { value, error: null };
}

export async function insertDocumentTemplate(
  db: SupabaseClient,
  input: DocumentTemplateInput,
  actorId: string,
): Promise<DocumentTemplate> {
  const { data, error } = await db
    .from(CDILV_TABLE.documentTemplates)
    .insert({ ...input, created_by: actorId, updated_by: actorId })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`Không tạo được mẫu văn bản: ${error.message}`);
  return mapRow(data as TemplateRow);
}

export async function updateDocumentTemplate(
  db: SupabaseClient,
  id: string,
  input: DocumentTemplateInput,
  actorId: string,
): Promise<DocumentTemplate | null> {
  const { data, error } = await db
    .from(CDILV_TABLE.documentTemplates)
    .update({ ...input, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`Không lưu được mẫu văn bản: ${error.message}`);
  return data ? mapRow(data as TemplateRow) : null;
}
