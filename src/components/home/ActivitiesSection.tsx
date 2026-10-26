"use client";

import { AdminShortcutLink } from "@/components/admin/AdminShortcutLink";
import { ActivityCard } from "@/components/home/ActivityCard";
import { WeeklyQuizActivityCard } from "@/components/home/WeeklyQuizActivityCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { Activity } from "@/lib/mock-data";

type ActivitiesSectionProps = {
  activities: Activity[];
};

export function ActivitiesSection({ activities }: ActivitiesSectionProps) {
  return (
    <section className="space-y-4" id="nhiem-vu">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MaterialIcon
            className="text-[24px] text-primary"
            name="event_available"
          />
          <h2 className="text-headline-md font-bold text-on-surface">
            Hoạt động nổi bật
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <AdminShortcutLink href="/admin/activities" icon="event_available" label="Quản lý hoạt động" />

          <a
            href="#nhiem-vu"
            className="flex items-center gap-1 text-label-md font-semibold text-primary transition-colors hover:text-dusty-dark"
          >
            Tất cả hoạt động ({activities.length + 1})
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
        <WeeklyQuizActivityCard />
        {activities.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} />
        ))}
      </div>
    </section>
  );
}
