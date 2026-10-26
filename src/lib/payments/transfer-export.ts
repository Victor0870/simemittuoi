/**
 * Bảng chuyển khoản ngân hàng từ danh sách đề nghị thanh toán (xuất Excel ở trang danh sách).
 * Chỉ đề nghị chuyển khoản còn tiền phải chi; tên / nội dung không dấu theo kiểu ngân hàng.
 */
import { fitTransferText, toAccountHolderName } from "@/lib/bank-transfer";
import type { PaymentRequestListItem } from "./server";

export type PaymentTransferRow = {
  code: string;
  name: string;
  account: string;
  bank: string;
  content: string;
  amount: number;
};

export const PAYMENT_TRANSFER_HEADER = [
  "STT",
  "Mã NV / Mã đối tượng",
  "Tên người nhận",
  "Số tài khoản",
  "Ngân hàng",
  "Nội dung chuyển khoản",
  "Số tiền (VNĐ)",
];

/** Số tiền chuyển = thực trả − đã tạm ứng (giống phiếu chi ghi sổ khi “Đã chi”). */
export function paymentTransferAmount(item: PaymentRequestListItem): number {
  return Math.max(item.total_amount - item.advanced_amount, 0);
}

export function buildPaymentTransferRows(items: PaymentRequestListItem[]): {
  rows: PaymentTransferRow[];
  skippedCash: number;
  skippedZero: number;
  /** Đề nghị chi theo danh sách thưởng, không có người nhận cụ thể – xuất ở trang Thanh toán thưởng. */
  skippedReward: number;
} {
  const rows: PaymentTransferRow[] = [];
  let skippedCash = 0;
  let skippedZero = 0;
  let skippedReward = 0;
  for (const item of items) {
    if (item.payment_method !== "transfer") {
      skippedCash++;
      continue;
    }
    if (item.has_reward_list && !item.receiver_account) {
      skippedReward++;
      continue;
    }
    const amount = paymentTransferAmount(item);
    if (amount <= 0) {
      skippedZero++;
      continue;
    }
    rows.push({
      code: item.receiver_code ?? "",
      name: toAccountHolderName(item.receiver_name ?? ""),
      account: item.receiver_account ?? "",
      bank: item.receiver_bank ?? "",
      content: fitTransferText(`${item.code} ${item.title}`),
      amount,
    });
  }
  return { rows, skippedCash, skippedZero, skippedReward };
}
