import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PostSummary } from "@/lib/data/posts";

type PostCardProps = {
  post: PostSummary;
};

export function PostCard({ post }: PostCardProps) {
  const isUrgent = post.tagTone === "error";

  return (
    <Link
      className="group block overflow-hidden rounded-2xl border border-y border-r border-dusty-border/80 border-l-4 border-l-primary bg-surface-container-lowest p-5 shadow-sm transition-all hover:shadow-md"
      href={`/posts/${post.id}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-dusty-border bg-dusty-light px-2.5 py-0.5 text-label-sm font-bold text-primary">
          {isUrgent ? (
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
          ) : (
            <MaterialIcon className="text-[14px]" name="article" />
          )}
          {post.tag}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-body-sm text-on-surface-variant">
          <MaterialIcon className="text-[14px]" name="calendar_today" />
          {post.timeAgo}
        </span>
      </div>
      <h3 className="mb-2 text-headline-sm font-bold text-on-surface transition-colors group-hover:text-primary">
        {post.title}
      </h3>
      <p className="mb-4 line-clamp-3 text-body-md text-on-surface-variant">
        {post.excerpt}
      </p>
      <div className="flex items-center justify-end border-t border-dusty-border/70 pt-3">
        <span className="inline-flex items-center gap-1 text-label-md font-bold text-primary">
          Đọc toàn văn
          <MaterialIcon className="text-[16px]" name="chevron_right" />
        </span>
      </div>
    </Link>
  );
}
