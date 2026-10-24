import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { PostCoverImage } from "@/components/posts/PostCoverImage";
import { PostShareButtons } from "@/components/posts/PostShareButtons";
import type { PostSummary } from "@/lib/data/posts";

type PostCardProps = {
  post: PostSummary;
};

export function PostCard({ post }: PostCardProps) {
  const isUrgent = post.tagTone === "error";

  return (
    <Link
      className="group block overflow-hidden rounded-2xl border border-y border-r border-dusty-border/80 border-l-4 border-l-primary bg-surface-container-lowest p-4 sm:p-5 shadow-xs transition-all hover:shadow-md"
      href={`/posts/${post.id}`}
    >
      <PostCoverImage
        alt={post.title}
        className="-mx-4 -mt-4 mb-3 block aspect-[16/9] w-[calc(100%+2rem)] max-w-none bg-slate-100 object-cover sm:-mx-5 sm:-mt-5 sm:mb-4 sm:w-[calc(100%+2.5rem)]"
        src={post.imageUrl}
      />
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full border border-dusty-border bg-dusty-light px-2.5 py-0.5 text-label-xs sm:text-label-sm font-bold text-primary">
            {isUrgent ? (
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
            ) : (
              <MaterialIcon className="text-[13px] sm:text-[14px]" name="article" />
            )}
            {post.tag}
          </span>
          {post.isActive === false && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-label-xs font-bold text-amber-900">
              <MaterialIcon className="text-[12px]" name="visibility_off" />
              Inactive
            </span>
          )}
          {post.isScheduled && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-label-xs font-bold text-sky-900">
              <MaterialIcon className="text-[12px]" name="schedule_send" />
              Hẹn giờ
            </span>
          )}
          {post.isImportant && (
            <span className="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error-container/80 px-2 py-0.5 text-label-xs font-bold text-error">
              <MaterialIcon className="text-[12px]" name="priority_high" />
              Ưu tiên
            </span>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-on-surface-variant">
          <MaterialIcon className="text-[13px] sm:text-[14px]" name="calendar_today" />
          {post.timeAgo}
        </span>
      </div>
      <h3 className="mb-1.5 text-title-md sm:text-headline-sm font-bold text-on-surface transition-colors group-hover:text-primary leading-snug">
        {post.title}
      </h3>
      <p className="mb-3 line-clamp-2 sm:line-clamp-3 text-body-sm sm:text-body-md text-on-surface-variant leading-relaxed">
        {post.excerpt}
      </p>
      <div className="flex items-center justify-between border-t border-dusty-border/70 pt-2.5 sm:pt-3">
        <PostShareButtons
          postId={post.id}
          postTitle={post.title}
          postExcerpt={post.excerpt}
          variant="card"
        />
        <span className="inline-flex items-center gap-1 text-label-sm sm:text-label-md font-bold text-primary">
          Đọc thêm
          <MaterialIcon className="text-[16px]" name="chevron_right" />
        </span>
      </div>
    </Link>
  );
}
