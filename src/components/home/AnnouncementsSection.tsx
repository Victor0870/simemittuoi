import Link from "next/link";
import { AnnouncementCard } from "@/components/home/AnnouncementCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { Announcement } from "@/lib/mock-data";

type AnnouncementsSectionProps = {
  announcements: Announcement[];
};

export function AnnouncementsSection({
  announcements,
}: AnnouncementsSectionProps) {
  return (
    <section className="space-y-4" id="thong-bao">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MaterialIcon className="text-[24px] text-primary" name="campaign" />
          <h2 className="text-headline-md font-bold text-on-surface">
            Thông báo quan trọng
          </h2>
        </div>
        <Link
          className="flex items-center gap-1 text-label-md font-semibold text-primary transition-colors hover:text-dusty-dark"
          href="/posts"
        >
          Xem tất cả
          <MaterialIcon className="text-[16px]" name="arrow_forward" />
        </Link>
      </div>

      {announcements.length === 0 ? (
        <p className="rounded-xl border border-dusty-border bg-white px-4 py-8 text-center text-sm text-on-surface-variant">
          Chưa có thông báo từ hệ thống.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
            />
          ))}
        </div>
      )}
    </section>
  );
}
