/**
 * Soạn văn bản từ mẫu: điền chỗ trống {{khoa}} và tách nội dung thành bố cục thể thức hành chính
 * (tiêu đề hai cột, tên loại + trích yếu, nội dung, Nơi nhận, chữ ký). Dùng chung cho xem trước và xuất .docx.
 */

import { SYSTEM_SETTING_TOKENS, type DocumentOrgSettings } from "./settings";
import { AUTO_NUMBER_KEY, DOCUMENT_TYPE_LABEL, type DocumentType, type TemplateField } from "./templates";

export const DOCUMENT_STATUSES = ["nhap", "da_ban_hanh"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const COMPOSE_LIMITS = { title: 300, value: 20_000 } as const;

export type FieldValues = Record<string, string>;

export type DocumentDraft = {
  id: string;
  templateId: string;
  type: DocumentType;
  title: string;
  fieldValues: FieldValues;
  status: DocumentStatus;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

/** Một đoạn chữ trong dòng; placeholder có mặt khi đoạn này đến từ một trường của mẫu. */
export type DocRun = {
  text: string;
  placeholder?: { key: string; label: string; required: boolean; empty: boolean };
};
export type DocLine = DocRun[];

export type BodyLineKind = "basis" | "article" | "bullet" | "heading" | "paragraph";
export type BodyLine = { kind: BodyLineKind; runs: DocLine };

export type DocumentLayout = {
  orgLines: DocLine[];
  numberLine: DocLine | null;
  nationalHeader: string;
  nationalMotto: string;
  placeDateLine: DocLine | null;
  titleLines: DocLine[];
  subjectLine: DocLine | null;
  body: BodyLine[];
  recipientsHeading: string | null;
  recipients: DocLine[];
  signatureLines: DocLine[];
  signerName: DocLine | null;
};

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const SYSTEM_VALUES = new Map(
  SYSTEM_SETTING_TOKENS.map((t) => [t.token.replace(/^\{\{|\}\}$/g, ""), t.getValue] as const),
);

const AUTO_NUMBER_RE = new RegExp(`\\{\\{\\s*${AUTO_NUMBER_KEY}\\s*\\}\\}`);

function autoNumberRun(): DocRun {
  return { text: "", placeholder: { key: AUTO_NUMBER_KEY, label: "Số cấp khi ban hành", required: false, empty: true } };
}

/** Trường để trống thì lấy giá trị mặc định từ Cài đặt đơn vị. */
const SETTING_FALLBACKS: Record<string, (s: DocumentOrgSettings) => string> = {
  nguoi_ky: (s) => s.signerName,
  noi_ban_hanh: (s) => s.defaultLocation,
};

export function isValidDateValue(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** "2026-02-05" → "05 tháng 02 năm 2026" (ngày < 10 và tháng < 3 thêm số 0 theo thể thức). */
export function formatVietnameseDate(value: string): string {
  const m = DATE_RE.exec(value);
  if (!m) return value;
  const day = Number(m[3]);
  const month = Number(m[2]);
  const dd = day < 10 ? `0${day}` : String(day);
  const mm = month < 3 ? `0${month}` : String(month);
  return `${dd} tháng ${mm} năm ${m[1]}`;
}

function formatNumber(value: string): string {
  const compact = value.replace(/\s/g, "");
  if (!/^-?\d+$/.test(compact)) return value;
  const sign = compact.startsWith("-") ? "-" : "";
  return sign + compact.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatFieldValue(field: TemplateField | undefined, raw: string): string {
  const value = raw.trim();
  if (!value || !field) return value;
  if (field.type === "date") return formatVietnameseDate(value);
  if (field.type === "number") return formatNumber(value);
  return value;
}

/** Chỉ giữ các khóa thuộc mẫu, giá trị là chuỗi (đã cắt độ dài). */
export function normalizeFieldValues(fields: TemplateField[], raw: unknown): FieldValues {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const values: FieldValues = {};
  for (const field of fields) {
    const v = source[field.key];
    if (typeof v !== "string") continue;
    const text = v.replace(/\r\n/g, "\n");
    const clean = field.type === "textarea" ? text : text.replace(/\s+/g, " ");
    if (clean.trim()) values[field.key] = clean.trim().slice(0, COMPOSE_LIMITS.value);
  }
  return values;
}

/** Lỗi nhập liệu theo khóa trường: bắt buộc chưa nhập, ngày / số sai định dạng. */
export function validateFieldValues(fields: TemplateField[], values: FieldValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = (values[field.key] ?? "").trim();
    if (!value) {
      if (field.required) errors[field.key] = "Bắt buộc nhập";
      continue;
    }
    if (field.type === "date" && !isValidDateValue(value)) errors[field.key] = "Ngày không hợp lệ";
    if (field.type === "number" && !/^-?[\d.,\s]+$/.test(value)) errors[field.key] = "Chỉ nhập số";
  }
  return errors;
}

export function describeFieldErrors(fields: TemplateField[], errors: Record<string, string>): string {
  return fields
    .filter((f) => errors[f.key])
    .map((f) => `${f.label} (${errors[f.key].toLowerCase()})`)
    .join(", ");
}

function fillLine(
  line: string,
  fieldMap: Map<string, TemplateField>,
  values: FieldValues,
  settings: DocumentOrgSettings,
): DocLine {
  const runs: DocLine = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) runs.push({ text: line.slice(last, index) });
    last = index + match[0].length;
    const key = match[1];
    if (key === AUTO_NUMBER_KEY) {
      runs.push(autoNumberRun());
      continue;
    }
    const field = fieldMap.get(key);
    if (!field) {
      const system = SYSTEM_VALUES.get(key);
      if (system) {
        runs.push({ text: system(settings) });
      } else {
        runs.push({ text: "", placeholder: { key, label: key, required: false, empty: true } });
      }
      continue;
    }
    const value = formatFieldValue(field, values[key] ?? "") || (SETTING_FALLBACKS[key]?.(settings) ?? "").trim();
    runs.push({ text: value, placeholder: { key, label: field.label, required: field.required, empty: !value } });
  }
  if (last < line.length) runs.push({ text: line.slice(last) });
  return runs;
}

/** Tách dòng tại các xuống dòng nằm trong giá trị (trường đoạn văn). */
function splitRuns(runs: DocLine): DocLine[] {
  const lines: DocLine[] = [[]];
  for (const run of runs) {
    const parts = run.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part || (i === 0 && run.placeholder?.empty)) lines[lines.length - 1].push({ ...run, text: part });
    });
  }
  return lines;
}

export function lineText(line: DocLine): string {
  return line.map((r) => r.text).join("");
}

function isUpperHeading(text: string): boolean {
  const t = text.trim();
  return /\p{L}/u.test(t) && t === t.toLocaleUpperCase("vi") && t.length <= 80;
}

function hasSignatureToken(raw: string): boolean {
  return /\{\{\s*(tham_quyen_ky|chuc_vu_ky|nguoi_ky|nguoi_ky_mac_dinh)\s*\}\}/.test(raw);
}

function classifyBodyLine(text: string): BodyLineKind {
  const t = text.trim();
  if (/^Căn cứ(\s|$)/i.test(t)) return "basis";
  if (/^Điều\s+\d+/i.test(t)) return "article";
  if (/^[-–•+]\s/.test(t)) return "bullet";
  if (isUpperHeading(t) && t.length <= 60) return "heading";
  return "paragraph";
}

/** Điền mẫu và dựng bố cục văn bản. */
export function layoutDocument(
  body: string,
  fields: TemplateField[],
  values: FieldValues,
  settings: DocumentOrgSettings,
): DocumentLayout {
  const fieldMap = new Map(fields.map((f) => [f.key, f]));
  const rawLines = body.replace(/\r\n/g, "\n").split("\n");
  const layout: DocumentLayout = {
    orgLines: [],
    numberLine: null,
    nationalHeader: settings.nationalHeader,
    nationalMotto: settings.nationalMotto,
    placeDateLine: null,
    titleLines: [],
    subjectLine: null,
    body: [],
    recipientsHeading: null,
    recipients: [],
    signatureLines: [],
    signerName: null,
  };
  const fill = (raw: string) => fillLine(raw, fieldMap, values, settings);

  let i = 0;
  while (i < rawLines.length && !rawLines[i].trim()) i++;

  // Khối tiêu đề (tới dòng trống đầu tiên) nếu có Số / Quốc hiệu / địa danh, ngày.
  let end = i;
  while (end < rawLines.length && rawLines[end].trim()) end++;
  const headBlock = rawLines.slice(i, end).map((l) => l.trim());
  const isHeader = headBlock.some(
    (l) => /^Số\s*:/i.test(l) || /CỘNG HÒA XÃ HỘI/i.test(l) || /,\s*ngày\b/i.test(l),
  );
  if (isHeader) {
    for (const raw of headBlock) {
      // Số cấp tự động đã gồm ký hiệu (mẫu số), nên bỏ phần đuôi như {{ky_hieu_qd}} sau chỗ trống số.
      if (/^Số\s*:/i.test(raw)) layout.numberLine = AUTO_NUMBER_RE.test(raw) ? [{ text: "Số: " }, autoNumberRun()] : fill(raw);
      else if (/CỘNG HÒA XÃ HỘI/i.test(raw)) layout.nationalHeader = lineText(fill(raw)).trim() || layout.nationalHeader;
      else if (/Độc lập\s*[-–]\s*Tự do/i.test(raw)) layout.nationalMotto = lineText(fill(raw)).trim() || layout.nationalMotto;
      else if (/\bngày\b/i.test(raw) && !layout.placeDateLine) layout.placeDateLine = fill(raw);
      else layout.orgLines.push(fill(raw));
    }
    i = end;
  }
  if (layout.orgLines.length === 0) {
    layout.orgLines = [settings.parentUnionName, settings.unionHeaderName].filter(Boolean).map((text) => [{ text }]);
  }

  // Phần chữ ký: khối cuối cùng có biến chữ ký hoặc bắt đầu bằng dòng in hoa (VD: NGƯỜI KÝ).
  let last = rawLines.length;
  while (last > i && !rawLines[last - 1].trim()) last--;
  let sigStart = last;
  while (sigStart > i && rawLines[sigStart - 1].trim()) sigStart--;
  const sigBlock = rawLines.slice(sigStart, last).map((l) => l.trim());
  const isSignature =
    sigBlock.length > 0 &&
    sigBlock.length <= 5 &&
    !/^Nơi nhận/i.test(sigBlock[0]) &&
    (sigBlock.some(hasSignatureToken) || isUpperHeading(lineText(fill(sigBlock[0]))));
  if (isSignature) {
    const filled = sigBlock.map(fill);
    const lastRaw = sigBlock[sigBlock.length - 1];
    const lastIsName = /\{\{\s*(nguoi_ky|nguoi_ky_mac_dinh)\s*\}\}/.test(lastRaw) || !isUpperHeading(lineText(filled[filled.length - 1]));
    if (lastIsName && filled.length > 1) {
      layout.signerName = filled[filled.length - 1];
      layout.signatureLines = filled.slice(0, -1);
    } else {
      layout.signatureLines = filled;
    }
  } else {
    sigStart = last;
  }

  // Tên loại (dòng in hoa) và trích yếu (V/v).
  const middle = rawLines.slice(i, sigStart);
  let j = 0;
  while (j < middle.length && !middle[j].trim()) j++;
  while (j < middle.length && middle[j].trim() && !/^V\/v\b/i.test(middle[j].trim())) {
    const filled = fill(middle[j].trim());
    if (!isUpperHeading(lineText(filled))) break;
    layout.titleLines.push(filled);
    j++;
  }
  if (j < middle.length && /^V\/v\b/i.test(middle[j].trim())) {
    layout.subjectLine = fill(middle[j].trim());
    j++;
  }

  // Nội dung và Nơi nhận.
  let inRecipients = false;
  for (const raw of middle.slice(j)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (/^Nơi nhận\s*:?/i.test(trimmed)) {
      inRecipients = true;
      layout.recipientsHeading = "Nơi nhận:";
      const rest = trimmed.replace(/^Nơi nhận\s*:?\s*/i, "");
      if (rest) layout.recipients.push(fill(rest));
      continue;
    }
    for (const line of splitRuns(fill(trimmed))) {
      const text = lineText(line);
      if (!text.trim() && !line.some((r) => r.placeholder?.empty)) continue;
      if (inRecipients) layout.recipients.push(line);
      else layout.body.push({ kind: classifyBodyLine(text), runs: line });
    }
  }
  return layout;
}

export function documentFileName(type: DocumentType, title: string, values: FieldValues): string {
  const slug = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [slug(DOCUMENT_TYPE_LABEL[type]), slug(values.so_van_ban ?? ""), slug(title).slice(0, 60)].filter(Boolean);
  return `${parts.join("_") || "van-ban"}.docx`;
}
