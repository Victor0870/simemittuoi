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
  if (announcements.length === 0) return null;

  return (
    <section className="space-y-4" id="thong-bao">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-red-100 p-2 text-red-700">
            <MaterialIcon className="text-[24px]" name="campaign" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-headline-md font-bold text-on-surface">
                Thông báo quan trọng
              </h2>
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700 uppercase">
                Ưu tiên
              </span>
            </div>
            <p className="text-body-sm text-on-surface-variant">
              Các thông báo khẩn và văn bản quan trọng từ Ban Chấp hành Công đoàn
            </p>
          </div>
        </div>
        <Link prefetch={false}
          className="flex items-center gap-1 text-label-md font-semibold text-primary transition-colors hover:text-dusty-dark"
          href="/posts"
        >
          <span>Xem tất cả</span>
          <MaterialIcon className="text-[16px]" name="arrow_forward" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
        {announcements.map((announcement) => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
          />
        ))}
      </div>
    </section>
  );
}
