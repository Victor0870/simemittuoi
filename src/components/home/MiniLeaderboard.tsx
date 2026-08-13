import Link from "next/link";
import { LeaderboardRow } from "@/components/home/LeaderboardRow";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { LeaderboardEntry } from "@/lib/mock-data";

type MiniLeaderboardProps = {
  entries: LeaderboardEntry[];
  maskIdentity?: boolean;
};

export function MiniLeaderboard({
  entries,
  maskIdentity = false,
}: MiniLeaderboardProps) {
  return (
    <section className="tonal-elevation-1 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-headline-md text-primary">Bảng vàng</h3>
        <MaterialIcon
          className="text-[#173A67] material-symbols-filled"
          filled
          name="trophy"
        />
      </div>

      {maskIdentity ? (
        <p className="mb-4 text-xs text-on-surface-variant">
          Khách chỉ xem điểm. Tên đã được che một phần. Đăng nhập để xem đầy đủ.
        </p>
      ) : null}

      <div className="space-y-4">
        {entries.map((entry) => (
          <LeaderboardRow
            key={entry.id}
            entry={entry}
            maskIdentity={maskIdentity}
          />
        ))}
      </div>

      <Link
        className="mt-6 flex w-full items-center justify-center rounded-xl border-2 border-tertiary py-3 font-bold text-on-tertiary-container transition-all hover:bg-tertiary hover:text-on-tertiary active:scale-95"
        href="/leaderboard"
      >
        Xem bảng xếp hạng đầy đủ
      </Link>
    </section>
  );
}
