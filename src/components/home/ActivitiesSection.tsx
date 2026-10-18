"use client";

import { useState } from "react";
import { ActivityCard } from "@/components/home/ActivityCard";
import { WeeklyQuizActivityCard } from "@/components/home/WeeklyQuizActivityCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";
import { ActivityEditorModal } from "@/components/activities/ActivityEditorModal";
import type { Activity } from "@/lib/mock-data";

type ActivitiesSectionProps = {
  activities: Activity[];
};

export function ActivitiesSection({ activities }: ActivitiesSectionProps) {
  const { isAdmin } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
          {isAdmin && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-amber-600 transition"
              type="button"
            >
              <MaterialIcon className="text-[18px]" name="add_circle" />
              <span>+ Tạo hoạt động mới</span>
            </button>
          )}

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

      {/* Admin Create Modal */}
      {isAdmin && (
        <ActivityEditorModal
          isOpen={isCreateOpen}
          mode="create"
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </section>
  );
}
