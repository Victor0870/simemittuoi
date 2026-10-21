/**
 * Đề nghị thăm hỏi đoàn viên: trạng thái, kiểm tra dữ liệu form (dùng ở cả trình duyệt và API).
 */
import { MAX_AMOUNT } from "@/lib/forms/settings";
import { TYPE_BY_CODE, describeSubject } from "@/lib/life-events/registry";
import { formatDateVi } from "@/lib/members/profile-shared";

export type VisitStatus = "proposed" | "approved" | "rejected" | "paid" | "cancelled";

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  proposed: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  paid: "Đã chi",
  cancelled: "Đã hủy",
};

export const VISIT_STATUS_TONE: Record<VisitStatus, string> = {
  proposed: "bg-amber-100 text-amber-900",
  approved: "bg-sky-100 text-sky-800",
  rejected: "bg-rose-100 text-rose-800",
  paid: "bg-[#D9F2EC] text-[#173A67]",
  cancelled: "bg-slate-200 text-slate-600",
};

export const VISIT_LOG_LABEL: Record<string, string> = {
  created: "Lập đề nghị",
  edited: "Sửa đề nghị",
  approved: "Duyệt",
  rejected: "Từ chối",
  paid: "Xác nhận đã chi",
  cancelled: "Hủy đề nghị",
  printed: "Tải phiếu in",
};

export const VISIT_LIMITS = {
  reason: 500,
  name: 120,
  note: 1000,
} as const;

export type VisitInput = {
  employeeCode: string;
  memberName: string;
  memberDepartment: string | null;
  eventType: string | null;
  reason: string;
  amount: number;
  visitorName: string;
  note: string | null;
};

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function parseVisitInput(
  raw: Record<string, unknown>,
): { ok: true; value: VisitInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const employeeCode = oneLine(raw.employeeCode).toUpperCase();
  const memberName = oneLine(raw.memberName);
  if (!employeeCode || !memberName) errors.push("Vui lòng chọn đoàn viên được thăm hỏi từ danh sách nhân viên.");
  if (employeeCode.length > 40 || memberName.length > VISIT_LIMITS.name) errors.push("Thông tin đoàn viên quá dài.");

  const eventType = oneLine(raw.eventType) || null;
  if (eventType && !TYPE_BY_CODE[eventType]) errors.push("Loại sự việc không hợp lệ.");

  const reason = oneLine(raw.reason);
  if (!reason) errors.push("Vui lòng nhập lý do thăm hỏi.");
  if (reason.length > VISIT_LIMITS.reason) errors.push(`Lý do tối đa ${VISIT_LIMITS.reason} ký tự.`);

  const amount = Math.round(Number(raw.amount));
  if (!Number.isFinite(amount) || amount <= 0) errors.push("Vui lòng nhập số tiền thăm hỏi.");
  else if (amount > MAX_AMOUNT) errors.push("Số tiền quá lớn.");

  const visitorName = oneLine(raw.visitorName);
  if (!visitorName) errors.push("Vui lòng nhập họ tên người thăm hỏi.");
  if (visitorName.length > VISIT_LIMITS.name) errors.push("Họ tên người thăm hỏi quá dài.");

  const note = typeof raw.note === "string" ? raw.note.trim() || null : null;
  if (note && note.length > VISIT_LIMITS.note) errors.push(`Ghi chú tối đa ${VISIT_LIMITS.note} ký tự.`);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      employeeCode,
      memberName,
      memberDepartment: oneLine(raw.memberDepartment) || null,
      eventType,
      reason,
      amount,
      visitorName,
      note,
    },
  };
}

/** Lý do mặc định từ tin báo, ví dụ "Ốm đau / nằm viện – Bố đẻ: Nguyễn Văn A (12/10/2026)". */
export function defaultVisitReason(event: {
  event_type: string;
  subject_relation: string;
  subject_name: string | null;
  event_date: string;
}): string {
  const type = TYPE_BY_CODE[event.event_type]?.label ?? event.event_type;
  const subject = event.subject_relation === "self" ? null : describeSubject(event.subject_relation, event.subject_name);
  return [type, subject].filter(Boolean).join(" – ") + ` (${formatDateVi(event.event_date)})`;
}

export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}
