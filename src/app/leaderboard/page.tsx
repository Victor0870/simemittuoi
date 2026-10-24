import { Suspense } from "react";
import { BackToHubBar } from "@/components/admin/BackToHubBar";
import {
  LeaderboardBoard,
  LeaderboardBoardFromUrl,
} from "@/components/leaderboard/LeaderboardBoard";
import { getLeaderboardEntries } from "@/lib/data/leaderboard";

// Trang dùng chung một bản cache; hạng của người đang xem được tải riêng ở phía trình duyệt.
export const revalidate = 300;

export default async function LeaderboardPage() {
  const entries = await getLeaderboardEntries(45);

  return (
    <>
      <BackToHubBar />
      <Suspense fallback={<LeaderboardBoard entries={entries} tab="10" />}>
        <LeaderboardBoardFromUrl entries={entries} />
      </Suspense>
    </>
  );
}
