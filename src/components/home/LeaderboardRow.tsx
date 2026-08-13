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
    <div
      className={`flex items-center gap-4 rounded-xl p-3 transition-colors ${
        entry.isTop
          ? "bg-surface-container hover:bg-surface-container-high"
          : "hover:bg-surface-container-high"
      }`}
    >
      <div className="relative">
        <div
          className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 text-sm font-bold text-[#173A67] ${
            entry.isTop
              ? "border-primary bg-primary-fixed"
              : "border-outline-variant bg-surface-container"
          }`}
        >
          {maskIdentity ? `#${entry.rank}` : null}
          {!maskIdentity && entry.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={entry.name}
              className="h-full w-full object-cover"
              src={entry.avatarUrl}
            />
          ) : null}
          {!maskIdentity && !entry.avatarUrl ? entry.name.slice(0, 1) : null}
        </div>
        {!maskIdentity ? (
          <span
            className={`absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              entry.isTop
                ? "bg-primary text-on-primary"
                : "bg-outline text-white"
            }`}
          >
            {entry.rank}
          </span>
        ) : null}
      </div>

      <div className="flex-1">
        <p className="font-bold text-on-surface">{displayName}</p>
        {!maskIdentity && entry.department ? (
          <p className="text-xs text-on-surface-variant">{entry.department}</p>
        ) : null}
      </div>

      <p className="font-extrabold text-primary">
        {entry.score.toLocaleString("vi-VN")}
      </p>
    </div>
  );
}
