/**
 * Giấy đề nghị thanh toán: nhãn, giới hạn, kiểm tra dữ liệu form (dùng ở cả trình duyệt và API).
 * Trạng thái dùng chung bộ nhãn / màu với đề nghị thăm hỏi.
 */
import { toTransferText } from "@/lib/bank-transfer";
import { MAX_AMOUNT } from "@/lib/forms/settings";

export { toTransferText };
import type { VisitStatus } from "@/lib/visits/registry";

export type PaymentStatus = VisitStatus;
export type PaymentMethod = "transfer" | "cash";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer: "Chuyển khoản",
  cash: "Tiền mặt",
};

export type PaymentReceiverKind = "organization" | "individual" | "member";

export const PAYMENT_RECEIVER_KIND_LABEL: Record<PaymentReceiverKind, string> = {
  organization: "Công ty",
  individual: "Cá nhân",
  member: "Đoàn viên",
};

export function isPaymentReceiverKind(value: unknown): value is PaymentReceiverKind {
  return value === "organization" || value === "individual" || value === "member";
}

export const PAYMENT_LOG_LABEL: Record<string, string> = {
  created: "Lập đề nghị",
  edited: "Sửa đề nghị",
  approved: "Duyệt",
  rejected: "Từ chối",
  paid: "Xác nhận đã chi",
  cancelled: "Hủy đề nghị",
  printed: "Tải giấy đề nghị",
  fund_posted: "Ghi sổ quỹ",
  fund_skipped: "Chưa ghi sổ quỹ",
};

export const PAYMENT_LIMITS = {
  /** Nhãn đề nghị (cột title, ràng buộc 1–200 ký tự trong CSDL). */
  title: 200,
  name: 120,
  account: 40,
  content: 300,
  note: 1000,
  items: 50,
  /** Số dòng chi in thẳng trên mẫu; nhiều hơn thì in “theo bảng kê” + trang Bảng kê. */
  slipRows: 5,
} as const;

export type PaymentItemInput = {
  content: string;
  paidTo: string | null;
  amount: number;
  advanced: number;
  visitRequestId: string | null;
  /** Chương trình bình chọn đã kết thúc – danh sách thưởng là chi tiết đi kèm của dòng chi. */
  rewardPollId: string | null;
};

export type PaymentInput = {
  requestDate: string;
  /** Tự tạo từ các dòng chi (paymentTitleFromItems) – không nhập trên form, không in trên phiếu. */
  title: string;
  requesterName: string;
  requesterDepartment: string | null;
  paymentMethod: PaymentMethod;
  /** null = chi theo danh sách thưởng đính kèm (không có người nhận chung). */
  receiverKind: PaymentReceiverKind | null;
  /** Đoàn viên nhận tiền (khi receiverKind = member). */
  receiverMemberId: string | null;
  receiverName: string | null;
  receiverAccount: string | null;
  receiverBank: string | null;
  /** Đối tượng trong danh mục (nếu chọn, chỉ với Công ty / Cá nhân) – để lập danh sách chuyển khoản. */
  counterpartyId: string | null;
  note: string | null;
  items: PaymentItemInput[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function money(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : NaN;
}

/** Nhãn đề nghị cho danh sách, thông báo và sổ quỹ: dòng chi đầu tiên (+ số khoản còn lại). */
export function paymentTitleFromItems(items: { content: string }[]): string {
  const first = items[0]?.content.trim() ?? "";
  const suffix = items.length > 1 ? ` (+${items.length - 1} khoản)` : "";
  const room = PAYMENT_LIMITS.title - suffix.length;
  const head = first.length > room ? `${first.slice(0, room - 1).trimEnd()}…` : first;
  return `${head}${suffix}`;
}

/** Ô trên form bị lỗi: tên trường, hoặc `items.<thứ tự dòng>.<trường>` cho dòng chi phí. */
export type PaymentField =
  | "requestDate"
  | "requesterName"
  | "requesterDepartment"
  | "receiverMemberId"
  | "receiverName"
  | "receiverAccount"
  | "receiverBank"
  | "note"
  | "items"
  | `items.${number}.${"content" | "paidTo" | "amount" | "advanced"}`;

export function parsePaymentInput(
  raw: Record<string, unknown>,
): { ok: true; value: PaymentInput } | { ok: false; errors: string[]; fields: PaymentField[] } {
  const errors: string[] = [];
  const fields = new Set<PaymentField>();
  const fail = (message: string, ...at: PaymentField[]) => {
    errors.push(message);
    for (const f of at) fields.add(f);
  };

  const requestDate = oneLine(raw.requestDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestDate) || Number.isNaN(Date.parse(requestDate))) {
    fail("Ngày đề nghị không hợp lệ.", "requestDate");
  }

  const requesterName = oneLine(raw.requesterName);
  if (!requesterName) fail("Vui lòng nhập người đề nghị.", "requesterName");
  const requesterDepartment = oneLine(raw.requesterDepartment) || null;
  if (requesterName.length > PAYMENT_LIMITS.name || (requesterDepartment?.length ?? 0) > PAYMENT_LIMITS.name) {
    fail(
      "Tên / bộ phận người đề nghị quá dài.",
      ...(requesterName.length > PAYMENT_LIMITS.name ? (["requesterName"] as const) : []),
      ...((requesterDepartment?.length ?? 0) > PAYMENT_LIMITS.name ? (["requesterDepartment"] as const) : []),
    );
  }

  const paymentMethod: PaymentMethod = raw.paymentMethod === "cash" ? "cash" : "transfer";
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const hasRewardList = rawItems.some((value) => {
    const id = (value as Record<string, unknown> | null)?.rewardPollId;
    return typeof id === "string" && UUID_RE.test(id);
  });
  if (hasRewardList && rawItems.length > 1) {
    fail("Đề nghị theo danh sách thưởng chỉ gồm một dòng chi là danh sách thưởng đó.", "items");
  }
  // Chi theo danh sách thưởng: mỗi người nhận theo danh sách đính kèm, không lưu người nhận / số TK / ngân hàng chung.
  const receiverName = hasRewardList ? null : oneLine(raw.receiverName) || null;
  const receiverAccount = hasRewardList ? null : oneLine(raw.receiverAccount).replace(/\s/g, "") || null;
  const receiverBank = hasRewardList ? null : oneLine(raw.receiverBank) || null;
  const receiverKind: PaymentReceiverKind | null = hasRewardList
    ? null
    : isPaymentReceiverKind(raw.receiverKind)
      ? raw.receiverKind
      : "organization";
  const receiverMemberId =
    receiverKind === "member" && typeof raw.receiverMemberId === "string" && UUID_RE.test(raw.receiverMemberId)
      ? raw.receiverMemberId
      : null;
  if (receiverKind === "member" && !receiverMemberId) {
    fail("Vui lòng chọn đoàn viên nhận tiền (theo tên hoặc mã NV).", "receiverMemberId");
  }
  const counterpartyId =
    receiverKind && receiverKind !== "member" && typeof raw.counterpartyId === "string" && UUID_RE.test(raw.counterpartyId)
      ? raw.counterpartyId
      : null;
  if ((receiverName?.length ?? 0) > PAYMENT_LIMITS.name || (receiverBank?.length ?? 0) > PAYMENT_LIMITS.name) {
    fail(
      "Tên người nhận / ngân hàng quá dài.",
      ...((receiverName?.length ?? 0) > PAYMENT_LIMITS.name ? (["receiverName"] as const) : []),
      ...((receiverBank?.length ?? 0) > PAYMENT_LIMITS.name ? (["receiverBank"] as const) : []),
    );
  }
  if ((receiverAccount?.length ?? 0) > PAYMENT_LIMITS.account) fail("Số tài khoản quá dài.", "receiverAccount");
  if (paymentMethod === "transfer" && !hasRewardList && (!receiverName || !receiverAccount || !receiverBank)) {
    fail(
      "Chuyển khoản cần đủ chủ tài khoản, số tài khoản và ngân hàng.",
      ...(receiverName ? [] : (["receiverName"] as const)),
      ...(receiverAccount ? [] : (["receiverAccount"] as const)),
      ...(receiverBank ? [] : (["receiverBank"] as const)),
    );
  }

  const note = typeof raw.note === "string" ? raw.note.trim() || null : null;
  if (note && note.length > PAYMENT_LIMITS.note) fail(`Ghi chú tối đa ${PAYMENT_LIMITS.note} ký tự.`, "note");

  const items: PaymentItemInput[] = [];
  const seenVisits = new Set<string>();
  const seenPolls = new Set<string>();
  rawItems.forEach((value, index) => {
    const item = (value ?? {}) as Record<string, unknown>;
    const line = `Dòng ${index + 1}`;
    const content = oneLine(item.content);
    const paidTo = oneLine(item.paidTo) || null;
    const amount = money(item.amount);
    const advanced = money(item.advanced);
    const visitRequestId = typeof item.visitRequestId === "string" && UUID_RE.test(item.visitRequestId) ? item.visitRequestId : null;
    const rewardPollId = typeof item.rewardPollId === "string" && UUID_RE.test(item.rewardPollId) ? item.rewardPollId : null;
    if (!content) fail(`${line}: chưa nhập chi tiết chi phí.`, `items.${index}.content`);
    if (content.length > PAYMENT_LIMITS.content) {
      fail(`${line}: chi tiết tối đa ${PAYMENT_LIMITS.content} ký tự.`, `items.${index}.content`);
    }
    if ((paidTo?.length ?? 0) > PAYMENT_LIMITS.name) fail(`${line}: tên người nhận quá dài.`, `items.${index}.paidTo`);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      fail(`${line}: số tiền không hợp lệ.`, `items.${index}.amount`);
    }
    if (!Number.isFinite(advanced) || advanced < 0 || advanced > MAX_AMOUNT) {
      fail(`${line}: số đã tạm ứng không hợp lệ.`, `items.${index}.advanced`);
    }
    if (visitRequestId) {
      if (seenVisits.has(visitRequestId)) fail(`${line}: phiếu thăm hỏi bị gom hai lần.`, `items.${index}.content`);
      seenVisits.add(visitRequestId);
    }
    if (rewardPollId) {
      if (seenPolls.has(rewardPollId)) fail(`${line}: danh sách thưởng bị thêm hai lần.`, `items.${index}.content`);
      seenPolls.add(rewardPollId);
    }
    items.push({ content, paidTo, amount, advanced, visitRequestId, rewardPollId });
  });
  if (!items.length) fail("Đề nghị phải có ít nhất một dòng chi phí.", "items");
  if (items.length > PAYMENT_LIMITS.items) fail(`Tối đa ${PAYMENT_LIMITS.items} dòng chi phí.`, "items");

  if (errors.length) return { ok: false, errors, fields: [...fields] };
  return {
    ok: true,
    value: {
      requestDate,
      title: paymentTitleFromItems(items),
      requesterName,
      requesterDepartment,
      paymentMethod,
      receiverKind,
      receiverMemberId,
      receiverName,
      receiverAccount,
      receiverBank,
      counterpartyId,
      note,
      items,
    },
  };
}

/** Tham số cho RPC cdilv_payment_request_save. */
export function paymentRpcPayload(input: PaymentInput) {
  return {
    p_header: {
      request_date: input.requestDate,
      title: input.title,
      requester_name: input.requesterName,
      requester_department: input.requesterDepartment,
      payment_method: input.paymentMethod,
      receiver_kind: input.receiverKind,
      receiver_member_id: input.receiverMemberId,
      receiver_name: input.receiverName,
      receiver_account: input.receiverAccount,
      receiver_bank: input.receiverBank,
      counterparty_id: input.counterpartyId,
      note: input.note,
    },
    p_items: input.items.map((item) => ({
      content: item.content,
      paid_to: item.paidTo,
      amount: item.amount,
      advanced: item.advanced,
      visit_request_id: item.visitRequestId,
      reward_poll_id: item.rewardPollId,
    })),
  };
}
