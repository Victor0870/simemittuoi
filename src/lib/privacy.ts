/**
 * Che tên cho khách:
 * - Giữ nguyên `keep` ký tự đầu (mặc định 7)
 * - Phần còn lại: từ đầu tiên giữ 1 chữ cái + x; các từ sau thay toàn bộ bằng x (giữ độ dài)
 * Ví dụ: "nguyễn văn Abc" → "nguyễn Vxx xxx"
 */
export function maskDisplayName(name: string, keep = 7): string {
  const trimmed = name.trim();
  if (!trimmed) return "xxxx";
  if (trimmed.length <= keep) return trimmed;

  const head = trimmed.slice(0, keep);
  const tail = trimmed.slice(keep);
  const parts = tail.split(/(\s+)/);
  let isFirstWord = true;

  const maskedTail = parts
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part;

      if (isFirstWord) {
        isFirstWord = false;
        const first = part.charAt(0).toLocaleUpperCase("vi-VN");
        return first + "x".repeat(Math.max(0, part.length - 1));
      }

      return "x".repeat(part.length);
    })
    .join("");

  return head + maskedTail;
}
