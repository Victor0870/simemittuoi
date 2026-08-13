/** Che tên cho khách: giữ tối đa 10 ký tự đầu, phần còn lại thay bằng xxxx */
export function maskDisplayName(name: string, keep = 10): string {
  const trimmed = name.trim();
  if (!trimmed) return "xxxx";
  if (trimmed.length <= keep) return trimmed;
  return `${trimmed.slice(0, keep)}xxxx`;
}
