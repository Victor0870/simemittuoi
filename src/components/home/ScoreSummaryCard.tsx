import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { DashboardUser } from "@/lib/data/home";

type ScoreSummaryCardProps = {
  user: DashboardUser;
};

export function ScoreSummaryCard({ user }: ScoreSummaryCardProps) {
  return (
    <div className="tonal-elevation-1 relative flex flex-col justify-between overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest p-8">
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <MaterialIcon
          className="text-8xl text-primary material-symbols-filled"
          filled
          name="workspace_premium"
        />
      </div>

      <div>
        <p className="mb-4 text-label-md tracking-wider text-on-surface-variant uppercase">
          Thành tích của bạn
        </p>
        <div className="mb-2 flex items-end gap-2">
          <span className="text-5xl font-extrabold text-primary">
            {user.score.toLocaleString("vi-VN")}
          </span>
          <span className="mb-1 text-xl font-medium text-on-surface-variant">
            điểm
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-outline-variant pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container">
            <span className="text-lg font-bold text-on-secondary-container">
              #{user.rank > 0 ? user.rank : "—"}
            </span>
          </div>
          <span className="font-semibold text-on-surface">Xếp hạng</span>
        </div>
        <Link
          className="flex items-center text-sm font-bold text-on-tertiary-container hover:underline"
          href="/leaderboard"
        >
          Chi tiết
          <MaterialIcon className="text-sm" name="chevron_right" />
        </Link>
      </div>
    </div>
  );
}
