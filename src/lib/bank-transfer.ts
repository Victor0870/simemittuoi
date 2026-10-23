/** Nội dung chuyển khoản ngân hàng: không dấu, ngắn để không bị ngân hàng cắt. */
export const TRANSFER_TEXT_MAX = 80;

/**
 * Chữ dùng được trong nội dung chuyển khoản: bỏ dấu tiếng Việt, chỉ giữ chữ, số, khoảng trắng và . , -
 * (ký tự khác thành khoảng trắng). Không cắt khoảng trắng cuối để gõ trực tiếp trên ô nhập được.
 */
export function toTransferText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[^A-Za-z0-9.,\- ]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^ /, "");
}

/** Tên chủ tài khoản theo kiểu ngân hàng: không dấu, viết hoa (VD "Vũ Thị Mai" → "VU THI MAI"). */
export function toAccountHolderName(name: string): string {
  return toTransferText(name).trim().toUpperCase();
}

/** Cắt nội dung về tối đa `max` ký tự, ưu tiên cắt ở ranh giới từ. */
export function fitTransferText(value: string, max = TRANSFER_TEXT_MAX): string {
  const text = toTransferText(value).trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : text.slice(0, max)).replace(/[\s,.-]+$/, "");
}
