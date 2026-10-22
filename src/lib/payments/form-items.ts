/** Dòng chi phí trên form đề nghị thanh toán – dùng được ở cả trang máy chủ và component trình duyệt. */
export type PaymentFormItem = {
  key: string;
  content: string;
  paidTo: string;
  amount: string;
  advanced: string;
  visitRequestId: string | null;
  visitCode: string | null;
};

let keySeed = 0;
export function newPaymentItem(patch: Partial<PaymentFormItem> = {}): PaymentFormItem {
  keySeed += 1;
  return {
    key: `i${Date.now()}-${keySeed}`,
    content: "",
    paidTo: "",
    amount: "",
    advanced: "",
    visitRequestId: null,
    visitCode: null,
    ...patch,
  };
}
