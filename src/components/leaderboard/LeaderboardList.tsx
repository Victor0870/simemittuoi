import { LeaderboardRow } from "@/components/home/LeaderboardRow";
import type { LeaderboardEntry } from "@/lib/mock-data";

type LeaderboardListProps = {
  entries: LeaderboardEntry[];
  maskIdentity?: boolean;
  highlightId?: string | null;
};

export function LeaderboardList({
  entries,
  maskIdentity = false,
  highlightId = null,
}: LeaderboardListProps) {
  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-12 text-center text-on-surface-variant">
        Chưa có dữ liệu xếp hạng.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const isMe = Boolean(highlightId && entry.id === highlightId);
        return (
          <div
            key={entry.id}
            className={
              isMe
                ? "rounded-xl ring-2 ring-tertiary ring-offset-2 ring-offset-surface"
                : undefined
            }
          >
            <LeaderboardRow entry={entry} maskIdentity={maskIdentity} />
          </div>
        );
      })}
    </div>
  );
}
