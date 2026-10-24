import { resizeImageToBlob } from "@/lib/image-resize";
import { POST_IMAGE_ERRORS, POST_IMAGE_MAX_BYTES, POST_IMAGE_MAX_WIDTH, POST_IMAGE_TYPES } from "@/lib/post-images";

/** Nén (cạnh dài tối đa 1600px, GIF giữ nguyên) rồi tải ảnh lên Storage qua API; trả về URL công khai. */
export async function uploadPostImage(file: File, endpoint = "/api/posts/images"): Promise<string> {
  if (!POST_IMAGE_TYPES[file.type]) throw new Error(POST_IMAGE_ERRORS.badType);
  const blob = await resizeImageToBlob(file, POST_IMAGE_MAX_WIDTH, 0.85).catch(() => file);
  if (blob.size > POST_IMAGE_MAX_BYTES) throw new Error(POST_IMAGE_ERRORS.tooLarge);

  const form = new FormData();
  form.append(
    "file",
    blob instanceof File ? blob : new File([blob], "post.jpg", { type: blob.type || "image/jpeg" }),
  );
  const res = await fetch(endpoint, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.url !== "string") throw new Error(data.error || "Không tải được ảnh lên.");
  return data.url;
}
