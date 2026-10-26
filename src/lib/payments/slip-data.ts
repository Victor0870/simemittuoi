/**
 * Dữ liệu Giấy đề nghị thanh toán theo đúng bố cục mẫu de_nghi_thanh_toan.xlsx – dùng chung cho
 * file Excel (print.ts) và bản xem trước HTML (PaymentSlipPreview), không phụ thuộc thư viện máy chủ.
 */
import { CHAIRMAN_TITLE } from "@/lib/chairman-title";
import type { FormSettings } from "@/lib/forms/settings";
import { PAYMENT_LIMITS, type PaymentMethod } from "./registry";

/** Mã đề nghị chỉ cấp khi lập – bản xem trước hiện chữ này thay cho mã. */
export const SLIP_CODE_PENDING = "Số: (cấp khi lập)";

export type SlipSource = {
  code: string | null;
  request_date: string;
  requester_name: string;
  requester_department: string | null;
  payment_method: PaymentMethod;
  receiver_name: string | null;
  receiver_account: string | null;
  receiver_bank: string | null;
  total_amount: number;
  advanced_amount: number;
};

export type SlipItem = {
  content: string;
  amount: number;
  advanced: number;
};

export type SlipSigners = Pick<FormSettings, "preparerDepartment" | "accountantName" | "chairmanName">;

export type PaymentSlipLine = {
  no: number;
  content: string;
  amount: number;
  /** null = để trống ô Đã tạm ứng. */
  advanced: number | null;
};

export type PaymentSlipData = {
  date: string;
  requester: string;
  department: string;
  /** Đúng PAYMENT_LIMITS.slipRows dòng, null = dòng trống. */
  lines: (PaymentSlipLine | null)[];
  /** Theo công thức trong mẫu: H17 = SUM(H12:H16), I17, H18 = H17 - I17, H19 = phần trả lại nếu dương. */
  totals: { paid: number; advanced: number; underPaid: number; overPaid: number | null };
  cash: boolean;
  bank: boolean;
  receiverName: string;
  receiverAccount: string;
  receiverBank: string;
  signatures: { title: string; name: string }[];
  /** Trang “Bảng kê” khi đề nghị nhiều dòng hơn mẫu chứa được. */
  itemSheet: {
    heading: string;
    rows: PaymentSlipLine[];
    totalPaid: number;
    totalAdvanced: number;
  } | null;
};

function advancedCell(value: number): number | null {
  return value > 0 ? value : null;
}

export function mapPaymentSlip(req: SlipSource, items: SlipItem[], signers: SlipSigners): PaymentSlipData {
  const useItemSheet = items.length > PAYMENT_LIMITS.slipRows;
  const slipLines: PaymentSlipLine[] = useItemSheet
    ? [
        {
          no: 1,
          content: `Chi theo bảng kê đính kèm (${items.length} khoản)`,
          amount: req.total_amount,
          advanced: advancedCell(req.advanced_amount),
        },
      ]
    : items.map((item, index) => ({
        no: index + 1,
        content: item.content,
        amount: item.amount,
        advanced: advancedCell(item.advanced),
      }));

  const paid = slipLines.reduce((sum, l) => sum + l.amount, 0);
  const advanced = slipLines.reduce((sum, l) => sum + (l.advanced ?? 0), 0);

  return {
    date: req.request_date.slice(0, 10),
    requester: req.requester_name,
    department: req.requester_department ?? signers.preparerDepartment,
    lines: Array.from({ length: PAYMENT_LIMITS.slipRows }, (_, i) => slipLines[i] ?? null),
    totals: { paid, advanced, underPaid: paid - advanced, overPaid: advanced > paid ? advanced - paid : null },
    cash: req.payment_method === "cash",
    bank: req.payment_method === "transfer",
    receiverName: req.receiver_name ?? "",
    receiverAccount: req.receiver_account ?? "",
    receiverBank: req.receiver_bank ?? "",
    signatures: [
      { title: "Người Lập", name: req.requester_name },
      { title: "Kế toán Công Đoàn", name: signers.accountantName },
      { title: CHAIRMAN_TITLE, name: signers.chairmanName },
    ],
    itemSheet: useItemSheet
      ? {
          heading: `BẢNG KÊ KÈM GIẤY ĐỀ NGHỊ THANH TOÁN ${req.code ?? SLIP_CODE_PENDING}`,
          rows: items.map((item, index) => ({
            no: index + 1,
            content: item.content,
            amount: item.amount,
            advanced: advancedCell(item.advanced),
          })),
          totalPaid: req.total_amount,
          totalAdvanced: req.advanced_amount,
        }
      : null,
  };
}
