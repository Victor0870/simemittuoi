"use client";

import { useState } from "react";
import { ActivityCard } from "@/components/home/ActivityCard";
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
            Tất cả hoạt động ({activities.length})
          </a>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-dusty-border bg-white px-4 py-8 text-center text-sm text-on-surface-variant">
          <MaterialIcon className="mx-auto mb-2 text-[36px] text-on-surface-variant/40" name="event_busy" />
          <p className="font-semibold text-on-surface">Chưa có hoạt động phong trào nào.</p>
          {isAdmin && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-3 inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white"
              type="button"
            >
              <MaterialIcon className="text-[16px]" name="add" />
              Tạo hoạt động đầu tiên ngay
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}

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
