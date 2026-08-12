import type { Announcement } from "@/lib/mock-data";

type AnnouncementCardProps = {
  announcement: Announcement;
};

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const borderClass =
    announcement.tagTone === "error" ? "border-error" : "border-tertiary";
  const tagClass =
    announcement.tagTone === "error"
      ? "bg-error-container text-on-error-container"
      : "bg-tertiary-container text-on-tertiary-container";

  return (
    <article
      className={`tonal-elevation-1 rounded-2xl border-l-4 bg-surface-container-lowest p-6 transition-all hover:tonal-elevation-2 ${borderClass}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${tagClass}`}
        >
          {announcement.tag}
        </span>
        <span className="text-label-sm text-on-surface-variant">
          {announcement.timeAgo}
        </span>
      </div>
      <h4 className="mb-2 font-bold text-on-surface">{announcement.title}</h4>
      <p className="line-clamp-2 text-body-md text-on-surface-variant">
        {announcement.excerpt}
      </p>
    </article>
  );
}
