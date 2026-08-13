import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList";
import { LeaderboardPodium } from "@/components/leaderboard/LeaderboardPodium";
import {
  LeaderboardViewTabs,
  type LeaderboardTab,
} from "@/components/leaderboard/LeaderboardViewTabs";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getLeaderboardPageData } from "@/lib/data/leaderboard";

type LeaderboardPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

function parseTab(raw: string | undefined): LeaderboardTab {
  return raw === "45" ? "45" : "10";
}

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  const params = (await searchParams) ?? {};
  const tab = parseTab(params.tab);
  const limit = tab === "45" ? 45 : 10;
  const data = await getLeaderboardPageData(45);
  const visible = data.entries.slice(0, limit);
  const rest = visible.filter((entry) => entry.rank > 3);

  const highlightId =
    data.currentUserId &&
    data.entries.find((e) => e.id === data.currentUserId)?.id;

  return (
    <AppShell activeHref="/leaderboard">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-label-md tracking-wider text-on-surface-variant uppercase">
            Thi đua đoàn viên
          </p>
          <h1 className="text-headline-xl font-extrabold text-[#173A67]">
            Bảng xếp hạng
          </h1>
          <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">
            Bục vinh danh Top 3, tiếp theo là bảng từ hạng 4 trở xuống (Top{" "}
            {limit}).
          </p>
        </div>
        <LeaderboardViewTabs active={tab} />
      </div>

      {!data.isGuest && data.currentRank > 0 ? (
        <div className="tonal-elevation-1 mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tertiary-container">
              <MaterialIcon
                className="text-2xl text-on-tertiary-container"
                filled
                name="military_tech"
              />
            </div>
            <div>
              <p className="text-sm text-on-surface-variant">Hạng của bạn</p>
              <p className="text-2xl font-extrabold text-primary">
                #{data.currentRank}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-on-surface-variant">Tổng điểm</p>
            <p className="text-2xl font-extrabold text-[#173A67]">
              {data.currentScore.toLocaleString("vi-VN")}
            </p>
          </div>
        </div>
      ) : null}

      {data.isGuest ? (
        <p className="mb-4 text-sm text-on-surface-variant">
          Khách chỉ xem điểm. Tên đã được che một phần.{" "}
          <Link className="font-bold text-primary hover:underline" href="/login">
            Đăng nhập
          </Link>{" "}
          để xem đầy đủ.
        </p>
      ) : null}

      <LeaderboardPodium entries={visible} maskIdentity={data.isGuest} />

      <section className="tonal-elevation-1 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-headline-md text-primary">
              {tab === "45" ? "Hạng 4 – 45" : "Hạng 4 – 10"}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Danh sách tiếp theo sau bục trao huy chương
            </p>
          </div>
          <MaterialIcon
            className="text-[#173A67] material-symbols-filled"
            filled
            name="format_list_numbered"
          />
        </div>

        <LeaderboardList
          entries={rest}
          highlightId={highlightId || null}
          maskIdentity={data.isGuest}
        />
      </section>
    </AppShell>
  );
}
