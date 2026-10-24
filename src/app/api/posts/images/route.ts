import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { uploadPostImageFromRequest } from "@/lib/post-images-server";

/** Tải ảnh bài viết (ảnh đại diện hoặc ảnh chèn nội dung) lên Storage; bài chỉ lưu URL khi bấm Lưu / Đăng. */
export async function POST(request: NextRequest) {
  const guard = await requirePermission(PERMISSIONS.postsManage);
  if (guard.response) return guard.response;

  return uploadPostImageFromRequest(request, "posts");
}
