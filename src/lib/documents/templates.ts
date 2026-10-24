/**
 * Mẫu văn bản công đoàn – xem supabase/migration_document_templates.sql.
 * body chứa chỗ trống {{khoa}}; fields mô tả từng chỗ trống (nhãn, kiểu nhập, bắt buộc) để bước
 * "Soạn văn bản" dựng form nhập, thay chỗ trống và xuất .docx mà không phải sửa code.
 */

import { SYSTEM_SETTING_TOKENS, applyOrgSettingsToText, type DocumentOrgSettings } from "./settings";

export const DOCUMENT_TYPES = ["quyet_dinh", "quy_dinh", "bien_ban_lam_viec", "bien_ban_cuoc_hop"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  quyet_dinh: "Quyết định",
  quy_dinh: "Quy định",
  bien_ban_lam_viec: "Biên bản làm việc",
  bien_ban_cuoc_hop: "Biên bản cuộc họp",
};

export const DOCUMENT_HEADING_UPPER: Record<DocumentType, string> = {
  quyet_dinh: "QUYẾT ĐỊNH",
  quy_dinh: "QUY ĐỊNH",
  bien_ban_lam_viec: "BIÊN BẢN LÀM VIỆC",
  bien_ban_cuoc_hop: "BIÊN BẢN CUỘC HỌP",
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

export type DecisionArticle = {
  title: string;
  content: string;
};

export type StructuredDocument = {
  /** Trích yếu văn bản (V/v: ...) */
  subject: string;
  /** Danh sách các dòng Căn cứ (thêm/bớt được) */
  bases: string[];
  /** Danh sách các Điều (Điều 1, Điều 2... thêm/bớt được, có tiêu đề + ô nhập nội dung) */
  articles: DecisionArticle[];
  /** Có hiển thị phần Nơi nhận ở cuối văn bản không */
  includeRecipients: boolean;
};

export const DOCUMENT_TEMPLATE_LIMITS = { name: 200, body: 100_000, fields: 50, fieldKey: 40, fieldLabel: 120 } as const;

/** Khóa trường: chữ thường không dấu, số, gạch dưới; bắt đầu bằng chữ. */
export const TEMPLATE_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

/** Các khóa cố định lấy tự động từ Cài đặt đơn vị (không bắt tạo trường nhập tay). */
export const SYSTEM_SETTING_KEYS = new Set(
  SYSTEM_SETTING_TOKENS.map((t) => t.token.replace(/^\{\{|\}\}$/g, "")),
);

/** Các trường dùng chung cho Quyết định / văn bản công đoàn. */
export const STANDARD_TEMPLATE_FIELDS: TemplateField[] = [
  { key: "so_van_ban", label: "Số văn bản (VD: 01-26)", type: "text", required: true },
  { key: "ngay", label: "Ngày ban hành", type: "date", required: true },
  { key: "nguoi_ky", label: "Người ký", type: "text", required: false },
];

/** Các Điều mẫu thường dùng để bấm thêm nhanh. */
export const PRESET_ARTICLES: { label: string; article: DecisionArticle }[] = [
  {
    label: "+ Điều Kinh phí thực hiện",
    article: {
      title: "Nguồn kinh phí thực hiện",
      content:
        "Kinh phí thực hiện được trích từ nguồn tài chính Công đoàn cơ sở theo quy chế chi tiêu nội bộ và các quy định hiện hành.",
    },
  },
  {
    label: "+ Điều Tổ chức thực hiện",
    article: {
      title: "Tổ chức thực hiện",
      content:
        "Các đồng chí trong Ban Chấp hành Công đoàn, bộ phận phụ trách tài chính Công đoàn và các cá nhân có liên quan chịu trách nhiệm thực hiện Quyết định này.",
    },
  },
  {
    label: "+ Điều Hiệu lực thi hành",
    article: {
      title: "Hiệu lực thi hành",
      content: "Quyết định này có hiệu lực kể từ ngày ký.",
    },
  },
];

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === "string" && (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function placeholderToken(key: string): string {
  return `{{${key}}}`;
}

/** Các khóa {{...}} xuất hiện trong body (không trùng, bỏ qua các biến cố định từ Cài đặt đơn vị). */
export function extractPlaceholders(body: string): string[] {
  const keys = new Set<string>();
  for (const match of body.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) {
    const k = match[1];
    if (!SYSTEM_SETTING_KEYS.has(k)) keys.add(k);
  }
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

/**
 * Ghép cấu trúc (Trích yếu, danh sách Căn cứ, danh sách các Điều) thành nội dung body chuẩn thể thức
 * có sử dụng biến cố định của đơn vị để phục vụ nhiều công ty.
 */
export function serializeStructuredDocument(docType: DocumentType, doc: StructuredDocument): string {
  const heading = DOCUMENT_HEADING_UPPER[docType];
  const lines: string[] = [
    "{{cong_doan_cap_tren}}",
    "{{ten_cdcs_hoa}}",
    "Số: {{so_van_ban}}{{ky_hieu_qd}}",
    "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "Độc lập - Tự do - Hạnh phúc",
    "{{dia_danh}}, ngày {{ngay}}",
    "",
    heading,
  ];

  const subjectClean = doc.subject.trim().replace(/^V\/v\s*:\s*/i, "").trim();
  if (subjectClean) {
    lines.push(`V/v: ${subjectClean}`);
  }
  lines.push("");

  const cleanBases = doc.bases.map((b) => b.trim()).filter(Boolean);
  for (const b of cleanBases) {
    const normalized = /^căn cứ/i.test(b) ? b : `Căn cứ ${b}`;
    lines.push(normalized);
  }

  if (docType === "quyet_dinh") {
    lines.push("");
    lines.push("QUYẾT ĐỊNH");
  }
  lines.push("");

  doc.articles.forEach((art, idx) => {
    const num = idx + 1;
    const title = art.title.trim();
    const content = art.content.trim();
    if (title) {
      lines.push(`Điều ${num}: ${title}`);
      if (content) lines.push(content);
    } else if (content) {
      lines.push(`Điều ${num}: ${content}`);
    } else {
      lines.push(`Điều ${num}:`);
    }
    lines.push("");
  });

  if (doc.includeRecipients) {
    lines.push("Nơi nhận:");
    lines.push("- BCH Công đoàn;");
    lines.push("- Bộ phận Tài chính/Kế toán CĐ;");
    lines.push("- Lưu: CĐ.");
    lines.push("");
  }

  lines.push("{{tham_quyen_ky}}");
  lines.push("{{chuc_vu_ky}}");
  lines.push("{{nguoi_ky}}");

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Tách ngược từ nội dung văn bản (body) ra cấu trúc { subject, bases, articles, includeRecipients }
 * để hiển thị lên trình dựng Căn cứ / Các Điều thêm bớt được.
 */
export function parseStructuredDocument(body: string, docType: DocumentType): StructuredDocument {
  if (!body.trim()) {
    return {
      subject: "",
      bases: [
        "Căn cứ Luật Công đoàn số 12/2012/QH13 ngày 20 tháng 6 năm 2012;",
        "Căn cứ Điều lệ Công đoàn Việt Nam khóa XIII;",
        "Căn cứ quy chế chi tiêu và nguồn kinh phí của Công đoàn cơ sở;",
      ],
      articles: [
        { title: "", content: "" },
        {
          title: "Tổ chức thực hiện",
          content:
            "Các đồng chí trong Ban Chấp hành Công đoàn, bộ phận phụ trách tài chính Công đoàn và các cá nhân có liên quan chịu trách nhiệm thực hiện Quyết định này.",
        },
        { title: "Hiệu lực thi hành", content: "Quyết định này có hiệu lực kể từ ngày ký." },
      ],
      includeRecipients: docType === "quyet_dinh",
    };
  }

  const rawLines = body.replace(/\r\n/g, "\n").split("\n");
  let subject = "";
  const bases: string[] = [];
  const articles: DecisionArticle[] = [];
  let includeRecipients = false;

  let currentArticle: DecisionArticle | null = null;
  let inFooter = false;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();

    if (/^Nơi nhận\s*:/i.test(line)) {
      includeRecipients = true;
      inFooter = true;
      if (currentArticle) {
        articles.push({ title: currentArticle.title.trim(), content: currentArticle.content.trim() });
        currentArticle = null;
      }
      continue;
    }

    if (
      /^(\{\{tham_quyen_ky\}\}|TM\.\s*BCH|NGƯỜI KÝ|CHỦ TỊCH|\{\{chuc_vu_ky\}\}|\{\{nguoi_ky\}\})/i.test(line)
    ) {
      inFooter = true;
      if (currentArticle) {
        articles.push({ title: currentArticle.title.trim(), content: currentArticle.content.trim() });
        currentArticle = null;
      }
      continue;
    }

    if (inFooter) continue;

    if (!subject && /^V\/v\s*:/i.test(line)) {
      subject = line.replace(/^V\/v\s*:\s*/i, "").trim();
      continue;
    }

    const articleMatch = line.match(/^Điều\s+\d+\s*[.:]\s*(.*)$/i);
    if (articleMatch) {
      if (currentArticle) {
        articles.push({ title: currentArticle.title.trim(), content: currentArticle.content.trim() });
      }
      currentArticle = { title: articleMatch[1].trim(), content: "" };
      continue;
    }

    if (currentArticle) {
      if (line || currentArticle.content) {
        currentArticle.content = currentArticle.content ? `${currentArticle.content}\n${rawLine}` : rawLine;
      }
      continue;
    }

    if (/^Căn cứ\b/i.test(line)) {
      bases.push(line);
    }
  }

  if (currentArticle) {
    articles.push({ title: currentArticle.title.trim(), content: currentArticle.content.trim() });
  }

  if (articles.length === 0) {
    articles.push({ title: "", content: "" });
  }

  return {
    subject,
    bases,
    articles,
    includeRecipients,
  };
}

/** Xem trước văn bản sau khi ghép các thông tin cố định của đơn vị từ Cài đặt. */
export function previewDocumentWithOrgSettings(body: string, settings: DocumentOrgSettings): string {
  const withOrg = applyOrgSettingsToText(body, settings);
  if (settings.signerName) {
    return withOrg.replace(/\{\{\s*nguoi_ky\s*\}\}/g, settings.signerName);
  }
  return withOrg;
}
