import { ActivityCard } from "@/components/home/ActivityCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { Activity } from "@/lib/mock-data";

type ActivitiesSectionProps = {
  activities: Activity[];
};

export function ActivitiesSection({ activities }: ActivitiesSectionProps) {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-headline-md text-primary">
          <MaterialIcon name="event_note" />
          Hoạt động nổi bật
        </h3>
        <button
          className="text-sm font-bold text-on-tertiary-container hover:underline"
          type="button"
        >
          Khám phá
        </button>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} />
        ))}
      </div>
    </section>
  );
}
