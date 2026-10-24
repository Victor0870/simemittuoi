import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { getPosts } from "@/lib/data/posts";
import { postCategoryBySlug } from "@/lib/post-categories";

export const dynamic = "force-dynamic";

/** Danh sách bài viết gồm cả bài Inactive / hẹn giờ, chỉ cho người có quyền quản lý bài viết. */
export async function GET(request: NextRequest) {
  const access = await getCurrentAccess();
  if (!access || !hasPermission(access, PERMISSIONS.postsManage)) {
    return NextResponse.json(
      { error: "Không có quyền." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const categorySlug = request.nextUrl.searchParams.get("category");
  const category = postCategoryBySlug(categorySlug);
  if (categorySlug && !category) {
    return NextResponse.json(
      { error: "Chuyên mục không hợp lệ." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const posts = await getPosts(50, { includeInactive: true, tag: category?.tag });
  return NextResponse.json(
    { posts },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
