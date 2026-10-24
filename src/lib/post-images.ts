/** Ảnh bài viết (ảnh đại diện + ảnh chèn trong nội dung): bucket công khai, tải lên qua API máy chủ. */
export const POST_IMAGE_BUCKET = "cdilv-post-images";
export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const POST_IMAGE_MAX_WIDTH = 1600;

export const POST_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const POST_IMAGE_ACCEPT = Object.keys(POST_IMAGE_TYPES).join(",");

export const POST_IMAGE_ERRORS = {
  tooLarge: "Ảnh vượt quá 5MB.",
  badType: "Định dạng ảnh không hỗ trợ (chỉ JPG, PNG, WEBP, GIF).",
} as const;

const STORAGE_PUBLIC_PREFIX = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "")}/storage/v1/object/public/`;

/** Chỉ ảnh công khai trong Storage của CDILV (bucket cdilv-*), không ký tự lạ. */
const STORAGE_OBJECT_PATTERN = /^cdilv-[a-z0-9-]+\/[A-Za-z0-9_./-]+\.(jpe?g|png|webp|gif)$/i;

export function postImagePublicUrl(path: string): string {
  return `${STORAGE_PUBLIC_PREFIX}${POST_IMAGE_BUCKET}/${path}`;
}

export function isAllowedPostImageUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 500) return false;
  if (!STORAGE_PUBLIC_PREFIX.startsWith("https://") || !url.startsWith(STORAGE_PUBLIC_PREFIX)) return false;
  const objectPath = url.slice(STORAGE_PUBLIC_PREFIX.length);
  return STORAGE_OBJECT_PATTERN.test(objectPath) && !objectPath.includes("..");
}

/** Ảnh chèn trong nội dung: ![mô tả](url) — mô tả và url không xuống dòng. */
export const POST_INLINE_IMAGE_PATTERN = /!\[([^\]\n]{0,200})\]\((https:\/\/[^\s)]+)\)/g;

export function postInlineImageMarkup(url: string, alt = "Ảnh"): string {
  return `![${alt.replace(/[\[\]\n]/g, " ").trim() || "Ảnh"}](${url})`;
}

/** Nhận diện ảnh theo vài byte đầu file (không tin hoàn toàn vào MIME do trình duyệt gửi). */
export function sniffPostImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 6 && String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/)) return "image/gif";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
