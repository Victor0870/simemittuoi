import Image from "next/image";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { Activity } from "@/lib/mock-data";

type ActivityCardProps = {
  activity: Activity;
};

export function ActivityCard({ activity }: ActivityCardProps) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-dusty-border/80 bg-surface-container-lowest shadow-sm transition-all hover:shadow-md sm:flex-row">
      <div className="relative h-48 overflow-hidden bg-dusty-light sm:h-auto sm:w-2/5">
        {activity.imageUrl ? (
          <Image
            alt={activity.imageAlt}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            height={240}
            src={activity.imageUrl}
            unoptimized
            width={320}
          />
        ) : (
          <div className="flex h-full min-h-48 items-center justify-center text-primary">
            <MaterialIcon className="text-[48px]" name="event" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 rounded-md bg-dusty-deep/90 px-2.5 py-1 text-label-sm font-bold text-white backdrop-blur-xs">
            <MaterialIcon className="text-[14px]" name="stars" />
            +{activity.points} điểm
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h4 className="text-headline-sm font-bold text-on-surface transition-colors group-hover:text-primary">
            {activity.title}
          </h4>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <MaterialIcon className="text-[16px]" name="calendar_month" />
              {activity.date}
            </span>
            <span className="inline-flex items-center gap-1">
              <MaterialIcon className="text-[16px]" name="location_on" />
              {activity.location}
            </span>
          </p>
        </div>

        <div className="mt-4 flex items-center justify-end border-t border-dusty-border/70 pt-3">
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-dusty-dark"
            type="button"
          >
            Đăng ký tham gia
          </button>
        </div>
      </div>
    </article>
  );
}
