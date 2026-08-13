import Link from "next/link";
import { LeaderboardRow } from "@/components/home/LeaderboardRow";
import { LeaderboardPodium } from "@/components/leaderboard/LeaderboardPodium";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { LeaderboardEntry } from "@/lib/mock-data";

type HomeLeaderboardSectionProps = {
  entries: LeaderboardEntry[];
  maskIdentity?: boolean;
};

export function HomeLeaderboardSection({
  entries,
  maskIdentity = false,
}: HomeLeaderboardSectionProps) {
  const nextThree = entries
    .filter((entry) => entry.rank > 3)
    .slice(0, 3);

  return (
    <section className="mb-10 space-y-6">
      <LeaderboardPodium
        entries={entries}
        maskIdentity={maskIdentity}
        variant="home"
      />

      <div className="tonal-elevation-1 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-headline-md text-primary">Tiếp theo trên bảng</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Ba vị trí ngay sau bục vinh danh
            </p>
          </div>
          <MaterialIcon
            className="text-[#173A67] material-symbols-filled"
            filled
            name="format_list_numbered"
          />
        </div>

        {maskIdentity ? (
          <p className="mb-4 text-xs text-on-surface-variant">
            Khách chỉ xem điểm. Tên đã được che một phần. Đăng nhập để xem đầy đủ.
          </p>
        ) : null}

        {nextThree.length > 0 ? (
          <div className="space-y-3">
            {nextThree.map((entry) => (
              <LeaderboardRow
                key={entry.id}
                entry={entry}
                maskIdentity={maskIdentity}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">
            Chưa có thêm người trong bảng xếp hạng.
          </p>
        )}

        <Link
          className="mt-6 flex w-full items-center justify-center rounded-xl border-2 border-tertiary py-3 font-bold text-on-tertiary-container transition-all hover:bg-tertiary hover:text-on-tertiary active:scale-95"
          href="/leaderboard"
        >
          Xem bảng xếp hạng đầy đủ
        </Link>
      </div>
    </section>
  );
}
