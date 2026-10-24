import { POST_INLINE_IMAGE_PATTERN } from "@/lib/post-images";

/** Đoạn in đậm trong nội dung bài viết: **chữ đậm** (không xuống dòng bên trong). */
export const POST_BOLD_PATTERN = /\*\*([^\n]+?)\*\*/g;

export function stripPostFormatting(text: string): string {
  return text.replace(POST_INLINE_IMAGE_PATTERN, " ").replace(POST_BOLD_PATTERN, "$1");
}
