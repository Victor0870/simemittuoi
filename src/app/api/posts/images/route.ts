import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  POST_IMAGE_ERRORS,
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_TYPES,
  postImagePublicUrl,
  sniffPostImageType,
} from "@/lib/post-images";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_STORAGE } from "@/lib/supabase/tables";

/** Tải ảnh bài viết (ảnh đại diện hoặc ảnh chèn nội dung) lên Storage; bài chỉ lưu URL khi bấm Lưu / Đăng. */
export async function POST(request: NextRequest) {
  const guard = await requirePermission(PERMISSIONS.postsManage);
  if (guard.response) return guard.response;

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
  const path = `posts/${month}/${now.getTime()}_${Math.random().toString(36).slice(2, 10)}.${POST_IMAGE_TYPES[sniffed]}`;
  const { error } = await createServiceClient()
    .storage.from(CDILV_STORAGE.postImages)
    .upload(path, file, { contentType: sniffed, upsert: false, cacheControl: "31536000" });
  if (error) {
    console.error("[api/posts/images] upload:", error.message);
    return NextResponse.json({ error: "Không tải được ảnh lên. Vui lòng thử lại." }, { status: 500 });
  }

  return NextResponse.json({ path, url: postImagePublicUrl(path) });
}
