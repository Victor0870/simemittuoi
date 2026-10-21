const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const UNITS = ["", "nghìn", "triệu", "tỷ"];

/** Đọc một nhóm 3 chữ số; `full` = có nhóm lớn hơn đứng trước (phải đọc đủ "không trăm", "lẻ"). */
function readTriple(n: number, full: boolean): string {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;
  const words: string[] = [];

  if (hundreds > 0 || full) words.push(DIGITS[hundreds], "trăm");

  if (tens > 1) {
    words.push(DIGITS[tens], "mươi");
    if (ones === 1) words.push("mốt");
    else if (ones === 4) words.push("tư");
    else if (ones === 5) words.push("lăm");
    else if (ones > 0) words.push(DIGITS[ones]);
  } else if (tens === 1) {
    words.push("mười");
    if (ones === 5) words.push("lăm");
    else if (ones > 0) words.push(DIGITS[ones]);
  } else if (ones > 0) {
    if (hundreds > 0 || full) words.push("lẻ");
    words.push(DIGITS[ones]);
  }
  return words.join(" ");
}

/** 500000 → "năm trăm nghìn"; hỗ trợ tới hàng nghìn tỷ. */
export function numberToVietnameseWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return DIGITS[0];

  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) {
      if (i > 0 && i % 3 === 0 && parts.length) parts.push(UNITS[3]);
      continue;
    }
    const unit = i === 0 ? "" : UNITS[i % 3 === 0 ? 3 : i % 3];
    parts.push([readTriple(g, parts.length > 0), unit].filter(Boolean).join(" "));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** 500000 → "Năm trăm nghìn đồng chẵn" (dòng "Bằng chữ" trên phiếu). */
export function vndInWords(value: number): string {
  const words = numberToVietnameseWords(value);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} đồng chẵn`;
}
