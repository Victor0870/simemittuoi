/** Trích xuất các URL ảnh trong nội dung bình luận để hiển thị ảnh trực quan. */
export function parseCommentContent(text: string): { cleanText: string; imageUrls: string[] } {
  if (!text) return { cleanText: "", imageUrls: [] };

  // Nhận diện các link ảnh thông dụng hoặc link upload từ Supabase Storage
  const imgUrlRegex =
    /(https?:\/\/[^\s]+?\.(?:png|jpe?g|webp|gif|svg)(?:\?[^\s]*)?|https?:\/\/[^\s]+?\/storage\/v1\/object\/public\/[^\s]+)/gi;

  const matches = text.match(imgUrlRegex) || [];
  const imageUrls: string[] = [];
  matches.forEach((url) => {
    // Làm sạch dấu ngoặc hoặc dấu câu ở cuối nếu bị dính
    const cleanUrl = url.replace(/[),;.]+$/, "");
    if (!imageUrls.includes(cleanUrl)) {
      imageUrls.push(cleanUrl);
    }
  });

  // Loại bỏ các dòng gắn nhãn link ảnh đính kèm mà KHÔNG ảnh hưởng đến chữ 'ảnh' trong văn bản của người dùng
  let cleanText = text;
  imageUrls.forEach((url) => {
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Chỉ loại bỏ tiền tố [Ảnh ...]: đi liền trên cùng một dòng với link ảnh
    cleanText = cleanText.replace(new RegExp(`\\[Ảnh[^\\]\\r\\n]*\\]:\\s*${escapedUrl}`, "gi"), "");
    // Loại bỏ link ảnh đứng riêng dòng hoặc còn sót lại
    cleanText = cleanText.replace(new RegExp(`^\\s*${escapedUrl}\\s*$`, "gim"), "");
    cleanText = cleanText.replace(new RegExp(`\\s*${escapedUrl}`, "gi"), "");
  });

  return { cleanText: cleanText.trim(), imageUrls };
}

/** Tải một ảnh về máy (fetch thành blob; lỗi CORS thì mở link tải trực tiếp). */
export async function downloadImageFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Fetch failed");
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
