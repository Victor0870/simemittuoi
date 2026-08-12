import { LeaderboardRow } from "@/components/home/LeaderboardRow";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { LeaderboardEntry } from "@/lib/mock-data";

type MiniLeaderboardProps = {
  entries: LeaderboardEntry[];
};

export function MiniLeaderboard({ entries }: MiniLeaderboardProps) {
  return (
    <section className="tonal-elevation-1 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-headline-md text-primary">Bảng vàng</h3>
        <MaterialIcon className="text-tertiary material-symbols-filled" filled name="trophy" />
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <LeaderboardRow key={entry.id} entry={entry} />
        ))}
      </div>

      <button
        className="mt-6 w-full rounded-xl border-2 border-primary py-3 font-bold text-primary transition-all hover:bg-primary hover:text-white active:scale-95"
        type="button"
      >
        Xem bảng xếp hạng đầy đủ
      </button>
    </section>
  );
}
