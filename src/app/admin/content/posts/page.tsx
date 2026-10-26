import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPostsManager } from "@/components/admin/AdminGuidePostsManager";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { BRAND } from "@/lib/brand";
import { getPostById, getPostDetails } from "@/lib/data/posts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Quản lý bài viết | ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const access = await getCurrentAccess();
  if (!access) {
    redirect("/login?next=/admin/content/posts");
  }
  if (!hasPermission(access, PERMISSIONS.postsManage)) {
    redirect("/");
  }

  const [posts, params] = await Promise.all([getPostDetails(200, { includeInactive: true }), searchParams]);
  const editId = params.edit ?? null;
  // Bài cần sửa nằm ngoài 200 bài mới nhất: vẫn đưa vào bảng để mở được form
  if (editId && !posts.some((p) => p.id === editId)) {
    const target = await getPostById(editId);
    if (target) posts.unshift(target);
  }

  return (
    <AdminPostsManager
      createLabel="Đăng bài mới"
      editId={editId}
      emptyText="Chưa có bài viết nào. Bấm “Đăng bài mới” để tạo bài đầu tiên."
      heading="Bài viết"
      intro={
        <>
          Tất cả bài viết (gồm cả bài Inactive và bài hẹn giờ). Bài Active hiện trên trang{" "}
          <Link prefetch={false} className="font-semibold text-primary hover:underline" href="/posts">
            /posts
          </Link>
          .
        </>
      }
      listLabel="Danh sách bài viết"
      openCreate={params.new === "1"}
      posts={posts}
      showTag
    />
  );
}
