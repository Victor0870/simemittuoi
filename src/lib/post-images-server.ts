import { NextRequest, NextResponse } from "next/server";
import {
  POST_IMAGE_ERRORS,
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_TYPES,
  postImagePublicUrl,
  sniffPostImageType,
} from "@/lib/post-images";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_STORAGE } from "@/lib/supabase/tables";

/** Nhận file ảnh từ form, kiểm tra loại / dung lượng rồi tải lên bucket ảnh bài viết; quyền do route gọi kiểm tra trước. */
export async function uploadPostImageFromRequest(request: NextRequest, folder: "posts" | "regulations") {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vui lòng chọn ảnh." }, { status: 400 });
  }
  if (file.size > POST_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: POST_IMAGE_ERRORS.tooLarge }, { status: 400 });
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffPostImageType(head);
  if (!sniffed || !POST_IMAGE_TYPES[file.type] || sniffed !== file.type) {
    return NextResponse.json({ error: POST_IMAGE_ERRORS.badType }, { status: 400 });
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const path = `${folder}/${month}/${now.getTime()}_${Math.random().toString(36).slice(2, 10)}.${POST_IMAGE_TYPES[sniffed]}`;
  const { error } = await createServiceClient()
    .storage.from(CDILV_STORAGE.postImages)
    .upload(path, file, { contentType: sniffed, upsert: false, cacheControl: "31536000" });
  if (error) {
    console.error(`[post-images] upload (${folder}):`, error.message);
    return NextResponse.json({ error: "Không tải được ảnh lên. Vui lòng thử lại." }, { status: 500 });
  }

  return NextResponse.json({ path, url: postImagePublicUrl(path) });
}
