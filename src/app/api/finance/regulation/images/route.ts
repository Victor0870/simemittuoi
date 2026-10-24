import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { uploadPostImageFromRequest } from "@/lib/post-images-server";

/** Tải ảnh chèn vào Quy chế chi tiêu (cùng bucket ảnh bài viết, thư mục regulations/). */
export async function POST(request: NextRequest) {
  const guard = await requirePermission(PERMISSIONS.financeManage);
  if (guard.response) return guard.response;

  return uploadPostImageFromRequest(request, "regulations");
}
