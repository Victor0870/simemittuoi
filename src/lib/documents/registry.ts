/**
 * Sổ văn bản đã ban hành – xem supabase/migration_document_registry.sql.
 * Bản scan đã ký, đóng dấu lưu ở bucket riêng tư; trình duyệt tải lên theo từng phần qua API
 * (giới hạn thân request của máy chủ) và chỉ xem qua link ký hạn ngắn do API cấp.
 */

import { isValidDateValue, type FieldValues } from "./compose";
import type { DocumentType } from "./templates";

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

export function todayInVietnam(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Ngày gợi ý cho hộp thoại ban hành: theo trường "ngay" của bản nháp (hoặc hôm nay). Số văn bản cấp tự động. */
export function issueDefaultDate(values: FieldValues): string {
  return values.ngay && isValidDateValue(values.ngay) ? values.ngay : todayInVietnam();
}
