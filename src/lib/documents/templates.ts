/**
 * Mẫu văn bản công đoàn – xem supabase/migration_document_templates.sql.
 * body chứa chỗ trống {{khoa}}; fields mô tả từng chỗ trống (nhãn, kiểu nhập, bắt buộc) để bước
 * "Soạn văn bản" dựng form nhập, thay chỗ trống và xuất .docx mà không phải sửa code.
 */

export const DOCUMENT_TYPES = ["quyet_dinh", "quy_dinh", "bien_ban_lam_viec", "bien_ban_cuoc_hop"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  quyet_dinh: "Quyết định",
  quy_dinh: "Quy định",
  bien_ban_lam_viec: "Biên bản làm việc",
  bien_ban_cuoc_hop: "Biên bản cuộc họp",
};

export const TEMPLATE_FIELD_TYPES = ["text", "textarea", "date", "number"] as const;
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];

export const TEMPLATE_FIELD_TYPE_LABEL: Record<TemplateFieldType, string> = {
  text: "Chữ (1 dòng)",
  textarea: "Đoạn văn",
  date: "Ngày",
  number: "Số",
};

export type TemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
};

export type DocumentTemplate = {
  id: string;
  name: string;
  docType: DocumentType;
  body: string;
  fields: TemplateField[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const DOCUMENT_TEMPLATE_LIMITS = { name: 200, body: 100_000, fields: 50, fieldKey: 40, fieldLabel: 120 } as const;

/** Khóa trường: chữ thường không dấu, số, gạch dưới; bắt đầu bằng chữ. */
export const TEMPLATE_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

/** Các trường dùng chung cho mọi loại văn bản. */
export const STANDARD_TEMPLATE_FIELDS: TemplateField[] = [
  { key: "so_van_ban", label: "Số văn bản", type: "text", required: true },
  { key: "ngay", label: "Ngày ban hành", type: "date", required: true },
  { key: "noi_ban_hanh", label: "Nơi ban hành", type: "text", required: false },
  { key: "nguoi_ky", label: "Người ký", type: "text", required: true },
  { key: "noi_dung", label: "Nội dung", type: "textarea", required: true },
];

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === "string" && (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function placeholderToken(key: string): string {
  return `{{${key}}}`;
}

/** Các khóa {{...}} xuất hiện trong body (không trùng, theo thứ tự xuất hiện). */
export function extractPlaceholders(body: string): string[] {
  const keys = new Set<string>();
  for (const match of body.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) keys.add(match[1]);
  return [...keys];
}

/** "Người ký" → "nguoi_ky" (gợi ý khóa từ nhãn). */
export function toTemplateFieldKey(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, DOCUMENT_TEMPLATE_LIMITS.fieldKey);
  if (!slug) return "";
  return /^[a-z]/.test(slug) ? slug : `f_${slug}`.slice(0, DOCUMENT_TEMPLATE_LIMITS.fieldKey);
}

/** Chuẩn hóa danh sách trường (từ DB hoặc form). Trả về lỗi đầu tiên nếu không hợp lệ. */
export function parseTemplateFields(raw: unknown): { fields: TemplateField[]; error: string | null } {
  if (raw == null) return { fields: [], error: null };
  if (!Array.isArray(raw)) return { fields: [], error: "Danh sách trường không hợp lệ." };
  if (raw.length > DOCUMENT_TEMPLATE_LIMITS.fields) {
    return { fields: [], error: `Tối đa ${DOCUMENT_TEMPLATE_LIMITS.fields} trường.` };
  }
  const fields: TemplateField[] = [];
  const seen = new Set<string>();
  for (const [index, item] of raw.entries()) {
    const o = (item ?? {}) as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key.trim() : "";
    const label = typeof o.label === "string" ? o.label.trim().replace(/\s+/g, " ") : "";
    const type = (TEMPLATE_FIELD_TYPES as readonly unknown[]).includes(o.type) ? (o.type as TemplateFieldType) : "text";
    const n = index + 1;
    if (!TEMPLATE_FIELD_KEY_PATTERN.test(key)) {
      return { fields: [], error: `Trường ${n}: khóa "${key}" không hợp lệ (chữ thường không dấu, số, gạch dưới).` };
    }
    if (seen.has(key)) return { fields: [], error: `Khóa "${key}" bị trùng.` };
    if (!label) return { fields: [], error: `Trường ${n} (${key}) chưa có nhãn.` };
    if (label.length > DOCUMENT_TEMPLATE_LIMITS.fieldLabel) return { fields: [], error: `Nhãn trường ${key} quá dài.` };
    seen.add(key);
    fields.push({ key, label, type, required: o.required === true });
  }
  return { fields, error: null };
}
