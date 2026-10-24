import { NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { getPosts } from "@/lib/data/posts";

export const dynamic = "force-dynamic";

/** Danh sách bài viết gồm cả bài Inactive / hẹn giờ, chỉ cho người có quyền quản lý bài viết. */
export async function GET() {
  const access = await getCurrentAccess();
  if (!access || !hasPermission(access, PERMISSIONS.postsManage)) {
    return NextResponse.json(
      { error: "Không có quyền." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const posts = await getPosts(50, { includeInactive: true });
  return NextResponse.json(
    { posts },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
