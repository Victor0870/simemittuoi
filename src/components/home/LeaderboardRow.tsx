import type { LeaderboardEntry } from "@/lib/mock-data";
import { maskDisplayName } from "@/lib/privacy";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type LeaderboardRowProps = {
  entry: LeaderboardEntry;
  /** Khách: che tên, chỉ hiện điểm */
  maskIdentity?: boolean;
  onSelectMember?: (entry: LeaderboardEntry) => void;
};

export function LeaderboardRow({
  entry,
  maskIdentity = false,
  onSelectMember,
}: LeaderboardRowProps) {
  const displayName = maskIdentity
    ? maskDisplayName(entry.name, 7)
    : entry.name;

  return (
    <div
      onClick={onSelectMember ? () => onSelectMember(entry) : undefined}
      className={`group flex items-center justify-between rounded-xl border border-dusty-border/60 bg-surface-muted/60 p-3 transition-all ${
        onSelectMember
          ? "cursor-pointer hover:border-primary hover:bg-white hover:shadow-xs active:scale-[0.99]"
          : "hover:border-primary hover:bg-white hover:shadow-xs"
      }`}
      role={onSelectMember ? "button" : undefined}
      tabIndex={onSelectMember ? 0 : undefined}
      onKeyDown={
        onSelectMember
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectMember(entry);
              }
            }
          : undefined
      }
      title="Bấm để xem lịch sử cộng điểm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dusty-light text-label-md font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-white">
          #{entry.rank}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="text-body-md font-bold text-on-surface transition-colors group-hover:text-primary">
              {displayName}
            </h4>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary text-[14px]">
              <MaterialIcon name="history_edu" className="text-[14px]" />
            </span>
          </div>
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
