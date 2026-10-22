import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/posts/PostCard";
import { PostCommentsSection } from "@/components/posts/PostCommentsSection";
import { PostEditButton } from "@/components/posts/PostEditButton";
import { PostShareButtons } from "@/components/posts/PostShareButtons";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getPostById, getPostCommentsCount, getRelatedPosts } from "@/lib/data/posts";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { BRAND } from "@/lib/brand";
import { formatScheduleLabel } from "@/lib/post-schedule";

export const revalidate = 60;

type PostDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PostDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) {
    return {
      title: `Bài viết | ${BRAND.name}`,
    };
  }

  const title = `${post.title} | ${BRAND.name}`;
  const description = post.excerpt || post.content.slice(0, 160).trim();
  const canonicalPath = `/posts/${post.id}`;
  const images = post.imageUrl ? [{ url: post.imageUrl }] : [];

  return {
    title,
    description,
    openGraph: {
      title: post.title,
      description,
      url: canonicalPath,
      siteName: BRAND.name,
      type: "article",
      publishedTime: post.publishedAt,
      images,
    },
    twitter: {
      card: post.imageUrl ? "summary_large_image" : "summary",
      title: post.title,
      description,
      images: post.imageUrl ? [post.imageUrl] : [],
    },
  };
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();

  if (!post.isActive || post.isScheduled) {
    const access = await getCurrentAccess();
    if (!access || !hasPermission(access, PERMISSIONS.postsManage)) notFound();
  }

  const [related, commentCount] = await Promise.all([
    getRelatedPosts(post.id, 6),
    getPostCommentsCount(post.id),
  ]);

  const publishedLabel = new Date(post.publishedAt).toLocaleString("vi-VN", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-4xl xl:max-w-5xl space-y-8 sm:space-y-10">
      <nav className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
        <Link className="hover:text-primary transition" href="/">
          Trang chủ
        </Link>
        <MaterialIcon className="text-[14px]" name="chevron_right" />
        <Link className="hover:text-primary transition" href="/posts">
          Bài viết
        </Link>
        <MaterialIcon className="text-[14px]" name="chevron_right" />
        <span className="line-clamp-1 text-on-surface font-medium">{post.title}</span>
      </nav>

      <article className="overflow-hidden rounded-2xl border border-dusty-border/80 bg-surface-container-lowest shadow-sm">
        <div className="border-b border-dusty-border/70 bg-gradient-to-r from-dusty-light/80 via-white to-white px-5 py-6 sm:px-10 sm:py-8">
          <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1 rounded-full border border-dusty-border bg-white px-2.5 py-0.5 text-label-xs sm:text-label-sm font-bold text-primary">
                <MaterialIcon className="text-[13px] sm:text-[14px]" name="article" />
                {post.tag}
              </span>
              <span className="inline-flex items-center gap-1 text-xs sm:text-body-sm text-on-surface-variant">
                <MaterialIcon className="text-[14px] sm:text-[16px]" name="schedule" />
                {publishedLabel}
              </span>
              <span className="text-xs sm:text-body-sm text-on-surface-variant">
                · {post.timeAgo}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PostShareButtons
                postId={post.id}
                postTitle={post.title}
                postExcerpt={post.excerpt}
                variant="compact"
              />
              <PostEditButton post={post} />
            </div>
          </div>
          {!post.isActive ? (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-950">
              <MaterialIcon className="text-[16px]" name="visibility_off" />
              Đang Inactive — chưa hiện với đoàn viên. Sửa bài rồi bật Active khi muốn đăng.
            </p>
          ) : null}
          {post.isActive && post.isScheduled ? (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-900">
              <MaterialIcon className="text-[16px]" name="schedule_send" />
              Đã hẹn giờ đăng lúc {formatScheduleLabel(post.publishedAt)} — đến giờ bài sẽ tự hiện với đoàn viên.
            </p>
          ) : null}
          <h1 className="text-xl sm:text-headline-lg md:text-headline-xl font-extrabold tracking-tight text-on-surface leading-tight">
            {post.title}
          </h1>
        </div>

        <div className="px-5 py-6 sm:px-10 sm:py-8 space-y-8">
          <div className="w-full whitespace-pre-wrap text-body-md sm:text-body-lg leading-relaxed text-on-surface">
            {post.content}
          </div>

          <PostShareButtons
            postId={post.id}
            postTitle={post.title}
            postExcerpt={post.excerpt}
            variant="full"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dusty-border/70 px-4 py-4 sm:px-10 sm:py-5">
          <Link
            className="inline-flex items-center gap-1 text-label-sm sm:text-label-md font-semibold text-primary hover:text-dusty-dark"
            href="/posts"
          >
            <MaterialIcon className="text-[16px] sm:text-[18px]" name="arrow_back" />
            Tất cả bài viết
          </Link>
          <Link
            className="inline-flex items-center gap-1 rounded-xl border border-primary px-3.5 py-1.5 sm:px-4 sm:py-2 text-label-sm sm:text-label-md font-bold text-primary transition-colors hover:bg-primary hover:text-white"
            href="/"
          >
            Về trang chủ
          </Link>
        </div>
      </article>

      <PostCommentsSection
        postId={post.id}
        postTitle={post.title}
        initialCommentCount={commentCount}
      />

      {related.length > 0 ? (
        <section className="space-y-5 border-t border-dusty-border/70 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <MaterialIcon className="text-[22px] text-primary" name="feed" />
              <h2 className="text-headline-md font-bold text-on-surface">
                Các bài viết khác
              </h2>
            </div>
            <Link
              className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
              href="/posts"
            >
              Xem tất cả
              <MaterialIcon className="text-[16px]" name="arrow_forward" />
            </Link>
          </div>

          <ul className="divide-y divide-dusty-border/70 overflow-hidden rounded-2xl border border-dusty-border/80 bg-white">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-dusty-light/50"
                  href={`/posts/${item.id}`}
                >
                  <div className="min-w-0 space-y-1">
                    <span className="inline-flex rounded-full border border-dusty-border bg-dusty-light px-2 py-0.5 text-[11px] font-bold text-primary">
                      {item.tag}
                    </span>
                    <p className="font-bold text-on-surface hover:text-primary">
                      {item.title}
                    </p>
                    <p className="line-clamp-1 text-body-sm text-on-surface-variant">
                      {item.excerpt}
                    </p>
                  </div>
                  <span className="shrink-0 self-center text-body-sm text-on-surface-variant">
                    {item.timeAgo}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
            {related.slice(0, 3).map((item) => (
              <PostCard key={`card-${item.id}`} post={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
