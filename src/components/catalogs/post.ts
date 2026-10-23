/** Gửi thao tác lưu danh mục; trả về thông báo lỗi hoặc null khi thành công. */
export async function postCatalog(body: unknown): Promise<string | null> {
  try {
    const res = await fetch("/api/catalogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? null : (data.error ?? "Không lưu được.");
  } catch {
    return "Mất kết nối, vui lòng thử lại.";
  }
}
