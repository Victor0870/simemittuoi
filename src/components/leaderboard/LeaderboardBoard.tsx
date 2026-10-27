"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  useViewerFetch,
  type ViewerSessionState,
} from "@/components/auth/useViewerSession";
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

function isGuestPosition(position: MyLeaderboardPosition) {
  return position.isGuest;
}

/**
 * Hạng / điểm của chính người xem (không nằm trong bản cache chung của trang).
 * session "unknown": chưa biết đăng nhập hay chưa → khung chờ.
 * complete: đã đủ thông tin hạng (từ /api/leaderboard/me, hoặc từ hồ sơ khi hồ sơ đã có hạng
 * và điểm > 0 — cùng quy tắc với getMyLeaderboardPosition).
 */
function useMyLeaderboardPosition(): {
  session: ViewerSessionState;
  complete: boolean;
  mine: MyLeaderboardPosition;
} {
  const { user, profile } = useAuth();
  const { session, loading, data } = useViewerFetch<MyLeaderboardPosition>(
    "/api/leaderboard/me",
    isGuestPosition,
  );

  if (session !== "member" || !user) {
    return { session, complete: session === "guest", mine: GUEST_POSITION };
  }
  if (data && !data.isGuest) {
    return { session, complete: true, mine: data };
  }

  const profileScore = profile?.total_score ?? 0;
  const profileHasRank = Boolean(profile?.rank) && profileScore > 0;
  return {
    session,
    complete: profileHasRank || !loading,
    mine: {
      isGuest: false,
      currentUserId: user.id,
      currentEmployeeCode: profile?.employee_code ?? null,
      currentRank: profileHasRank ? Number(profile?.rank) : 0,
      currentScore: profileHasRank ? profileScore : 0,
    },
  };
}

type LeaderboardBoardProps = {
  entries: LeaderboardEntry[];
  tab: LeaderboardTab;
};

export function LeaderboardBoard({ entries, tab }: LeaderboardBoardProps) {
  const { session, complete, mine } = useMyLeaderboardPosition();
  const limit = tab === "45" ? 45 : 10;
  const visible = entries.slice(0, limit);
  const rest = visible.filter((entry) => entry.rank > 3);
  const isMember = session === "member";
  const highlightId = isMember
    ? (visible.find((entry) => isCurrentUserEntry(entry, mine))?.id ?? null)
    : null;
  const userInView = visible.some((entry) => isCurrentUserEntry(entry, mine));
  const showMyRank = isMember && complete && mine.currentRank > 0 && !userInView;

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

      {session === "guest" ? (
        <p className="mb-4 text-sm text-on-surface-variant">
          Khách chỉ xem điểm. Tên đã được che một phần.{" "}
          <Link prefetch={false} className="font-bold text-primary hover:underline" href="/login">
            Đăng nhập
          </Link>{" "}
          để xem đầy đủ và lịch sử cộng điểm.
        </p>
      ) : null}

      {session === "unknown" ? (
        <div aria-busy="true" className="animate-pulse space-y-6">
          <div className="grid h-72 grid-cols-3 items-end gap-4 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
            <div className="h-2/3 rounded-2xl bg-surface-container" />
            <div className="h-full rounded-2xl bg-surface-container" />
            <div className="h-1/2 rounded-2xl bg-surface-container" />
          </div>
          <div className="space-y-3 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 md:p-8">
            {Array.from({ length: Math.min(rest.length, 7) || 3 }, (_, i) => (
              <div key={i} className="h-14 rounded-xl bg-surface-container" />
            ))}
          </div>
        </div>
      ) : (
        <LeaderboardInteractiveView
          visibleEntries={visible}
          restEntries={rest}
          highlightId={highlightId}
          isGuest={!isMember}
          tab={tab}
        />
      )}

      {showMyRank ? <MyRankSummary rank={mine.currentRank} score={mine.currentScore} /> : null}
    </>
  );
}

/** Đọc ?tab= ở phía trình duyệt để trang vẫn được cache tĩnh. */
export function LeaderboardBoardFromUrl({ entries }: { entries: LeaderboardEntry[] }) {
  const searchParams = useSearchParams();
  return <LeaderboardBoard entries={entries} tab={parseTab(searchParams.get("tab"))} />;
}
