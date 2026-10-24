import Link from "next/link";
import { BackToHubBar } from "@/components/admin/BackToHubBar";
import { PostCard } from "@/components/posts/PostCard";
import { PostEditButton } from "@/components/posts/PostEditButton";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { getPosts } from "@/lib/data/posts";

export const revalidate = 60;

export default async function PostsPage() {
  const access = await getCurrentAccess();
  const canManage = access ? hasPermission(access, PERMISSIONS.postsManage) : false;

  const posts = await getPosts(50, { includeInactive: canManage });

  return (
    <div className="space-y-8">
      <BackToHubBar />
      <header className="space-y-3 border-b border-dusty-border/70 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-dusty-light p-2 text-primary">
            <MaterialIcon className="text-[24px]" name="newspaper" />
          </div>
          <div>
            <h1 className="text-headline-lg font-bold tracking-tight text-on-surface">
              Bài viết
            </h1>
            <p className="text-body-sm text-on-surface-variant">
              Thông báo, sự kiện và tin hoạt động Công đoàn CDILV
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:text-dusty-dark"
            href="/"
          >
            <MaterialIcon className="text-[16px]" name="arrow_back" />
            Về trang chủ
          </Link>
          {canManage ? <PostEditButton /> : null}
        </div>
      </header>

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dusty-border bg-white px-4 py-12 text-center text-sm text-on-surface-variant">
          Chưa có bài viết nào. Vui lòng quay lại sau.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
