/**
 * Sổ văn bản đã ban hành – xem supabase/migration_document_registry.sql.
 * Bản scan đã ký, đóng dấu lưu ở bucket riêng tư; trình duyệt tải lên theo từng phần qua API
 * (giới hạn thân request của máy chủ) và chỉ xem qua link ký hạn ngắn do API cấp.
 */

import { isValidDateValue, layoutDocument, lineText, type DocumentLayout, type FieldValues } from "./compose";
import type { DocumentOrgSettings } from "./settings";
import type { DocumentTemplate, DocumentType } from "./templates";

export const SCAN_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type ScanMimeType = (typeof SCAN_MIME_TYPES)[number];

export const SCAN_EXT: Record<ScanMimeType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const SCAN_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  chunkBytes: 3 * 1024 * 1024,
  maxChunks: 4,
  number: 60,
} as const;

export type IssuedDocument = {
  id: string;
  templateId: string;
  type: DocumentType;
  title: string;
  soVanBan: string;
  ngayBanHanh: string;
  scanKind: "pdf" | "image" | null;
  issuedAt: string;
  issuedByName: string;
  createdByName: string;
  congKhai: boolean;
};

export function isScanMimeType(value: unknown): value is ScanMimeType {
  return typeof value === "string" && (SCAN_MIME_TYPES as readonly string[]).includes(value);
}

/** Số gợi ý khi ban hành: phần sau "Số:" của tiêu đề văn bản, bỏ trống nếu còn chỗ trống chưa nhập. */
export function suggestIssueNumber(layout: DocumentLayout): string {
  const line = layout.numberLine;
  if (!line || line.some((r) => r.placeholder?.empty)) return "";
  return lineText(line).replace(/^Số\s*:\s*/i, "").trim().slice(0, SCAN_LIMITS.number);
}

export function todayInVietnam(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Giá trị gợi ý cho hộp thoại ban hành: số theo tiêu đề văn bản, ngày theo trường "ngay" (hoặc hôm nay). */
export function issueDefaults(
  template: DocumentTemplate | undefined,
  values: FieldValues,
  settings: DocumentOrgSettings,
): { number: string; date: string } {
  const date = values.ngay && isValidDateValue(values.ngay) ? values.ngay : todayInVietnam();
  if (!template) return { number: "", date };
  return { number: suggestIssueNumber(layoutDocument(template.body, template.fields, values, settings)), date };
}
