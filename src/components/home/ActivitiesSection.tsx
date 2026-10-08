import { ActivityCard } from "@/components/home/ActivityCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { Activity } from "@/lib/mock-data";

type ActivitiesSectionProps = {
  activities: Activity[];
};

export function ActivitiesSection({ activities }: ActivitiesSectionProps) {
  return (
    <section className="space-y-4" id="nhiem-vu">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MaterialIcon
            className="text-[24px] text-primary"
            name="event_available"
          />
          <h2 className="text-headline-md font-bold text-on-surface">
            Hoạt động nổi bật
          </h2>
        </div>
        <button
          className="flex items-center gap-1 text-label-md font-semibold text-primary transition-colors hover:text-dusty-dark"
          type="button"
        >
          Khám phá tất cả
          <MaterialIcon className="text-[16px]" name="arrow_forward" />
        </button>
      </div>

      {activities.length === 0 ? (
        <p className="rounded-xl border border-dusty-border bg-white px-4 py-8 text-center text-sm text-on-surface-variant">
          Chưa có hoạt động từ hệ thống.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </section>
  );
}
