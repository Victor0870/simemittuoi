/**
 * Số văn bản tự động – xem supabase/migration_document_numbering.sql và migration_document_number_start.sql.
 * Mỗi loại văn bản có một mẫu số và chu kỳ đếm; số được cấp ở máy chủ (hàm cdilv_document_issue) đúng lúc ban hành.
 * Số bắt đầu (start) áp dụng cho kỳ đếm hiện tại: số tiếp theo = max(số bắt đầu, số đã cấp gần nhất trong kỳ + 1).
 */

import { DOCUMENT_TYPES, type DocumentType } from "./templates";

export type NumberingReset = "yearly" | "monthly";

export type NumberingSeries = {
  type: DocumentType;
  format: string;
  pad: number;
  reset: NumberingReset;
  /** Bắt đầu từ số – cho kỳ đếm hiện tại. */
  start: number;
};

/** Trạng thái kỳ đếm hiện tại theo cấu hình đã lưu. */
export type NumberingStatus = {
  /** "2026" hoặc "2026-10" */
  period: string;
  /** Số thứ tự đã cấp gần nhất trong kỳ (gồm số nhập tay khớp mẫu số), 0 nếu chưa cấp. */
  lastIssued: number;
  /** Số sẽ cấp tiếp theo. */
  next: string;
};

export const NUMBERING_LIMITS = { formatMin: 4, formatMax: 40, padMin: 1, padMax: 5, startMax: 999999 } as const;

export function numberingPeriodLabel(period: string): string {
  const [year, month] = period.split("-");
  return month ? `tháng ${month}/${year}` : `năm ${year}`;
}

export const NUMBERING_TOKENS: { token: string; label: string }[] = [
  { token: "{so}", label: "Số thứ tự (bắt buộc)" },
  { token: "{yy}", label: "Năm 2 số" },
  { token: "{yyyy}", label: "Năm 4 số" },
  { token: "{mm}", label: "Tháng 2 số" },
];

export const NUMBERING_RESET_LABEL: Record<NumberingReset, string> = {
  yearly: "Đếm lại từ 01 mỗi năm",
  monthly: "Đếm lại từ 01 mỗi tháng",
};

export const DEFAULT_NUMBERING: Record<DocumentType, Omit<NumberingSeries, "type">> = {
  quyet_dinh: { format: "{so}-{yy}/QĐ-CĐCS", pad: 2, reset: "yearly", start: 1 },
  quy_dinh: { format: "{so}-{yy}/QyĐ-CĐCS", pad: 2, reset: "yearly", start: 1 },
  bien_ban_lam_viec: { format: "{so}-{yy}/BBLV-CĐCS", pad: 2, reset: "yearly", start: 1 },
  bien_ban_cuoc_hop: { format: "{so}-{yy}/BB-CĐCS", pad: 2, reset: "yearly", start: 1 },
};

export function defaultNumberingSeries(): NumberingSeries[] {
  return DOCUMENT_TYPES.map((type) => ({ type, ...DEFAULT_NUMBERING[type] }));
}

/** Cùng quy tắc với hàm SQL cdilv_document_number_format (dùng để xem trước khi sửa mẫu). */
export function formatDocumentNumber(format: string, pad: number, seq: number, date: string): string {
  const so = String(seq).padStart(pad, "0");
  return format
    .split("{so}").join(so)
    .split("{yyyy}").join(date.slice(0, 4))
    .split("{yy}").join(date.slice(2, 4))
    .split("{mm}").join(date.slice(5, 7));
}

/** Lỗi của một dòng cấu hình (khớp ràng buộc trong bảng cdilv_document_number_series), null nếu hợp lệ. */
export function numberingError(series: Pick<NumberingSeries, "format" | "pad" | "reset" | "start">): string | null {
  if (!Number.isInteger(series.start) || series.start < 1 || series.start > NUMBERING_LIMITS.startMax) {
    return `Bắt đầu từ số phải là số nguyên từ 1 đến ${NUMBERING_LIMITS.startMax}.`;
  }
  const format = series.format.trim();
  if (!format.includes("{so}")) return "Mẫu số phải có {so}.";
  if (format.length < NUMBERING_LIMITS.formatMin || format.length > NUMBERING_LIMITS.formatMax) {
    return `Mẫu số dài ${NUMBERING_LIMITS.formatMin}–${NUMBERING_LIMITS.formatMax} ký tự.`;
  }
  if (!Number.isInteger(series.pad) || series.pad < NUMBERING_LIMITS.padMin || series.pad > NUMBERING_LIMITS.padMax) {
    return `Số chữ số từ ${NUMBERING_LIMITS.padMin} đến ${NUMBERING_LIMITS.padMax}.`;
  }
  if (series.reset === "monthly" && !format.includes("{mm}")) {
    return "Đếm lại theo tháng thì mẫu số phải có {mm} để số không trùng trong năm.";
  }
  return null;
}
