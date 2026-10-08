import type { LeaderboardEntry } from "@/lib/mock-data";
import { maskDisplayName } from "@/lib/privacy";

type LeaderboardRowProps = {
  entry: LeaderboardEntry;
  /** Khách: che tên, chỉ hiện điểm */
  maskIdentity?: boolean;
};

export function LeaderboardRow({
  entry,
  maskIdentity = false,
}: LeaderboardRowProps) {
  const displayName = maskIdentity
    ? maskDisplayName(entry.name, 7)
    : entry.name;

  return (
    <div className="group flex items-center justify-between rounded-xl border border-dusty-border/60 bg-surface-muted/60 p-3 transition-all hover:border-primary hover:bg-white hover:shadow-xs">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dusty-light text-label-md font-bold text-primary">
          #{entry.rank}
        </div>
        <div>
          <h4 className="text-body-md font-bold text-on-surface transition-colors group-hover:text-primary">
            {displayName}
          </h4>
          {!maskIdentity && entry.department ? (
            <span className="text-[11px] text-on-surface-variant">
              {entry.department}
            </span>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <span className="text-headline-sm font-bold text-primary">
          {entry.score.toLocaleString("vi-VN")}
        </span>
        <span className="-mt-1 block text-body-sm font-medium text-on-surface-variant">
          điểm
        </span>
      </div>
    </div>
  );
}
