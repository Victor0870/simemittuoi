import { revalidateTag } from "next/cache";
import {
  LEADERBOARD_CACHE_TAG,
  RANKING_REVALIDATE_SECONDS,
  pollResultsCacheTag,
} from "@/lib/ranking-cache";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";

/**
 * Nhờ DB tính lại thứ hạng nếu có điểm mới và lần tính trước đã quá `maxAgeSeconds` giây.
 * Cần supabase/migration_leaderboard_refresh_15min.sql; khi chưa chạy migration thì hàm chưa có (PGRST202) và được bỏ qua.
 */
export async function refreshLeaderboardIfStale(maxAgeSeconds = RANKING_REVALIDATE_SECONDS) {
  try {
    const { error } = await createServiceClient().rpc(CDILV_RPC.refreshLeaderboardIfStale, {
      p_max_age_seconds: maxAgeSeconds,
    });
    if (error && error.code !== "PGRST202") {
      console.error("[leaderboard] refresh_if_stale:", error.message);
    }
  } catch (err) {
    console.error("[leaderboard] refresh_if_stale:", err);
  }
}

/** Thao tác admin chốt / thu hồi điểm chính thức: tính lại thứ hạng ngay và bỏ cache bảng xếp hạng. */
export async function publishLeaderboardNow() {
  await refreshLeaderboardIfStale(0);
  revalidateTag(LEADERBOARD_CACHE_TAG, { expire: 0 });
}

/** Thao tác admin đổi chương trình / chốt kết quả bình chọn: bỏ cache kết quả của chương trình đó. */
export function invalidatePollResults(pollId: string) {
  revalidateTag(pollResultsCacheTag(pollId), { expire: 0 });
}
