import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { PostShareButtons } from "@/components/posts/PostShareButtons";
import type { Announcement } from "@/lib/mock-data";

type AnnouncementCardProps = {
  announcement: Announcement;
};

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const isUrgent = announcement.tagTone === "error";

  return (
    <Link prefetch={false}
      className="group relative block overflow-hidden rounded-2xl border border-y border-r border-dusty-border/80 border-l-4 border-l-primary bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md"
      href={`/posts/${announcement.id}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full border border-dusty-border bg-dusty-light px-2.5 py-0.5 text-label-sm font-bold text-primary">
          {isUrgent ? (
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
          ) : (
            <MaterialIcon className="text-[14px]" name="article" />
          )}
          {announcement.tag}
        </span>
        <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
          <MaterialIcon className="text-[14px]" name="calendar_today" />
          {announcement.timeAgo}
        </span>
      </div>
      <h3 className="mb-2 text-headline-sm font-bold text-on-surface transition-colors group-hover:text-primary">
        {announcement.title}
      </h3>
      <p className="mb-4 line-clamp-2 text-body-md text-on-surface-variant">
        {announcement.excerpt}
      </p>
      <div className="flex items-center justify-between border-t border-dusty-border/70 pt-3">
        <PostShareButtons
          postId={announcement.id}
          postTitle={announcement.title}
          postExcerpt={announcement.excerpt}
          variant="card"
        />
        <span className="inline-flex items-center gap-1 text-label-md font-bold text-primary">
          Đọc thêm
          <MaterialIcon className="text-[16px]" name="chevron_right" />
        </span>
      </div>
    </Link>
  );
}
