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
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-headline-md text-primary">
          <MaterialIcon className="text-error" name="campaign" />
          Thông báo quan trọng
        </h3>
        <button
          className="text-sm font-bold text-primary hover:underline"
          type="button"
        >
          Xem tất cả
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
