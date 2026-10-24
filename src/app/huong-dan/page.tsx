import type { Metadata } from "next";
import Link from "next/link";
import { PostEditButton } from "@/components/posts/PostEditButton";
import { PostsListClient } from "@/components/posts/PostsListClient";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { BRAND } from "@/lib/brand";
import { getPosts } from "@/lib/data/posts";
import { GUIDE_POST_CATEGORY } from "@/lib/post-categories";

// Như /posts: bản cache chung chỉ gồm bài đang hiển thị; bài Inactive / hẹn giờ chỉ người có quyền thấy (phía trình duyệt).
export const revalidate = 60;

export const metadata: Metadata = {
  title: `${GUIDE_POST_CATEGORY.tag} | ${BRAND.name}`,
  description: "Các bài hướng dẫn sử dụng website CDILV.",
};

export default async function GuidePostsPage() {
  const posts = await getPosts(50, { tag: GUIDE_POST_CATEGORY.tag });

  return (
    <div className="space-y-8">
      <header className="space-y-3 border-b border-dusty-border/70 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-dusty-light p-2 text-primary">
            <MaterialIcon className="text-[24px]" name="menu_book" />
          </div>
          <div>
            <h1 className="text-headline-lg font-bold tracking-tight text-on-surface">
              {GUIDE_POST_CATEGORY.tag}
            </h1>
            <p className="text-body-sm text-on-surface-variant">
              Các bài hướng dẫn sử dụng website CDILV
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
          <PostEditButton defaultTag={GUIDE_POST_CATEGORY.tag} />
        </div>
      </header>

      <PostsListClient
        categorySlug={GUIDE_POST_CATEGORY.slug}
        emptyMessage="Chưa có bài hướng dẫn nào."
        initialPosts={posts}
      />
    </div>
  );
}
