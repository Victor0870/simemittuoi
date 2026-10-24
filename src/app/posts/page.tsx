import Link from "next/link";
import { BackToHubBar } from "@/components/admin/BackToHubBar";
import { PostEditButton } from "@/components/posts/PostEditButton";
import { PostsListClient } from "@/components/posts/PostsListClient";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getPosts } from "@/lib/data/posts";

// Bản cache chung chỉ gồm bài đang hiển thị; nút đăng bài và bài Inactive chỉ hiện với người có quyền (phía trình duyệt).
export const revalidate = 60;

export default async function PostsPage() {
  const posts = await getPosts(50);

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
          <PostEditButton />
        </div>
      </header>

      <PostsListClient initialPosts={posts} />
    </div>
  );
}
