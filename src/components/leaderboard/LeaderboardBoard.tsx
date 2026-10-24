"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { LeaderboardInteractiveView } from "@/components/leaderboard/LeaderboardInteractiveView";
import { MyRankSummary } from "@/components/leaderboard/MyRankSummary";
import {
  LeaderboardViewTabs,
  type LeaderboardTab,
} from "@/components/leaderboard/LeaderboardViewTabs";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { MyLeaderboardPosition } from "@/lib/data/leaderboard";
import type { LeaderboardEntry } from "@/lib/mock-data";
import { RANKING_UPDATE_NOTE } from "@/lib/ranking-cache";

const GUEST_POSITION: MyLeaderboardPosition = {
  isGuest: true,
  currentUserId: null,
  currentEmployeeCode: null,
  currentRank: 0,
  currentScore: 0,
};

function parseTab(raw: string | null | undefined): LeaderboardTab {
  return raw === "45" ? "45" : "10";
}

function isCurrentUserEntry(entry: LeaderboardEntry, data: MyLeaderboardPosition): boolean {
  if (data.currentUserId && entry.id === data.currentUserId) return true;
  if (
    data.currentEmployeeCode &&
    (entry.id === data.currentEmployeeCode ||
      entry.id.toUpperCase() === data.currentEmployeeCode.toUpperCase())
  ) {
    return true;
  }
  return data.currentRank > 0 && entry.rank === data.currentRank;
}

/** Hạng / điểm của chính người xem, tải riêng (không nằm trong bản cache chung của trang). */
function useMyLeaderboardPosition(): { loading: boolean; mine: MyLeaderboardPosition } {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ loading: boolean; mine: MyLeaderboardPosition }>({
    loading: true,
    mine: GUEST_POSITION,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setState({ loading: false, mine: GUEST_POSITION });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ loading: true, mine: prev.mine }));
    fetch("/api/leaderboard/me", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<MyLeaderboardPosition>) : GUEST_POSITION))
      .catch(() => GUEST_POSITION)
      .then((mine) => {
        if (!cancelled) setState({ loading: false, mine });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  return state;
}

type LeaderboardBoardProps = {
  entries: LeaderboardEntry[];
  tab: LeaderboardTab;
};

export function LeaderboardBoard({ entries, tab }: LeaderboardBoardProps) {
  const { loading, mine } = useMyLeaderboardPosition();
  const limit = tab === "45" ? 45 : 10;
  const visible = entries.slice(0, limit);
  const rest = visible.filter((entry) => entry.rank > 3);
  const maskIdentity = loading || mine.isGuest;
  const highlightId = loading
    ? null
    : (visible.find((entry) => isCurrentUserEntry(entry, mine))?.id ?? null);
  const userInView = visible.some((entry) => isCurrentUserEntry(entry, mine));
  const showMyRank = !loading && !mine.isGuest && mine.currentRank > 0 && !userInView;

  return (
    <>
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
          <p className="mt-1 inline-flex items-center gap-1.5 text-label-md text-primary">
            <MaterialIcon className="text-[16px]" name="schedule" />
            {RANKING_UPDATE_NOTE}
          </p>
        </div>
        <LeaderboardViewTabs active={tab} />
      </div>

      {!loading && mine.isGuest ? (
        <p className="mb-4 text-sm text-on-surface-variant">
          Khách chỉ xem điểm. Tên đã được che một phần.{" "}
          <Link className="font-bold text-primary hover:underline" href="/login">
            Đăng nhập
          </Link>{" "}
          để xem đầy đủ và lịch sử cộng điểm.
        </p>
      ) : null}

      <LeaderboardInteractiveView
        visibleEntries={visible}
        restEntries={rest}
        highlightId={highlightId}
        isGuest={maskIdentity}
        tab={tab}
      />

      {showMyRank ? <MyRankSummary rank={mine.currentRank} score={mine.currentScore} /> : null}
    </>
  );
}

/** Đọc ?tab= ở phía trình duyệt để trang vẫn được cache tĩnh. */
export function LeaderboardBoardFromUrl({ entries }: { entries: LeaderboardEntry[] }) {
  const searchParams = useSearchParams();
  return <LeaderboardBoard entries={entries} tab={parseTab(searchParams.get("tab"))} />;
}
