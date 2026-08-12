import Image from "next/image";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { Activity } from "@/lib/mock-data";

type ActivityCardProps = {
  activity: Activity;
};

export function ActivityCard({ activity }: ActivityCardProps) {
  return (
    <article className="tonal-elevation-1 group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest transition-all hover:tonal-elevation-2 sm:flex-row">
      <div className="h-32 overflow-hidden sm:h-auto sm:w-48">
        <Image
          alt={activity.imageAlt}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          height={192}
          src={activity.imageUrl}
          width={192}
        />
      </div>

      <div className="flex flex-1 flex-col justify-between p-6">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-lg font-bold text-primary">{activity.title}</h4>
            <p className="mt-1 flex items-center gap-1 text-sm text-on-surface-variant">
              <MaterialIcon className="text-sm" name="calendar_month" />
              {activity.date} • {activity.location}
            </p>
          </div>
          <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
            +{activity.points} Điểm
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex -space-x-2">
            {activity.participantAvatars.map((avatar, index) => (
              <div
                key={`${activity.id}-avatar-${index}`}
                className="h-8 w-8 overflow-hidden rounded-full border-2 border-surface bg-gray-200"
              >
                <Image
                  alt=""
                  className="h-full w-full object-cover"
                  height={32}
                  src={avatar}
                  width={32}
                />
              </div>
            ))}
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-primary text-[10px] font-bold text-white">
              +{activity.extraParticipants}
            </div>
          </div>
          <button
            className="rounded-lg bg-tertiary px-4 py-2 text-sm font-bold text-on-tertiary transition-shadow hover:shadow-md"
            type="button"
          >
            Đăng ký
          </button>
        </div>
      </div>
    </article>
  );
}
