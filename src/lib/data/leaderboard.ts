import { unstable_cache } from "next/cache";
import type { LeaderboardEntry } from "@/lib/mock-data";
import { getSessionUserId } from "@/lib/auth/session";
import { refreshLeaderboardIfStale } from "@/lib/data/ranking-refresh";
import { LEADERBOARD_CACHE_TAG, RANKING_REVALIDATE_SECONDS } from "@/lib/ranking-cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type MyLeaderboardPosition = {
  isGuest: boolean;
  currentUserId: string | null;
  currentEmployeeCode: string | null;
  currentRank: number;
  currentScore: number;
};

type LeaderboardRow = {
  id: string | null;
  full_name: string;
  department: string | null;
  avatar_url: string | null;
  employee_code: string | null;
  total_score: number;
  rank: number | string;
};

function mapRows(rows: LeaderboardRow[]): LeaderboardEntry[] {
  return rows.map((row, index) => ({
    id: row.id ?? row.employee_code ?? `rank-${row.rank}`,
    rank: Number(row.rank),
    name: row.full_name,
    department: row.department ?? "",
    score: Number(row.total_score) || 0,
    avatarUrl: row.avatar_url ?? "",
    isTop: index === 0 || Number(row.rank) === 1,
    employeeCode: row.employee_code ?? null,
    userId: row.id ?? null,
  }));
}

async function loadLeaderboardRows(limit: number): Promise<{
  rows: LeaderboardRow[];
  error: string | null;
}> {
  const db = createServiceClient();
  const { data, error } = await db
    .from(CDILV_TABLE.leaderboard)
    .select(
      "id, full_name, department, avatar_url, employee_code, total_score, rank",
    )
    .order("rank", { ascending: true })
    .limit(limit);

  if (!error && data?.length) return { rows: data, error: null };

  const cache = await db
    .from(CDILV_TABLE.leaderboardCache)
    .select(
      "id, full_name, department, avatar_url, employee_code, total_score, rank",
    )
    .gt("total_score", 0)
    .order("rank", { ascending: true })
    .limit(limit);
  if (!cache.error && cache.data?.length) return { rows: cache.data, error: null };

  return { rows: data ?? [], error: error?.message ?? null };
}

const getCachedLeaderboardRows = unstable_cache(
  async (limit: number) => {
    await refreshLeaderboardIfStale();
    const result = await loadLeaderboardRows(limit);
    // Không lưu cache kết quả lỗi, để lần sau truy vấn lại ngay
    if (result.error) throw new Error(result.error);
    return result.rows;
  },
  ["leaderboard-rows"],
  { revalidate: RANKING_REVALIDATE_SECONDS, tags: [LEADERBOARD_CACHE_TAG] },
);

async function getLeaderboardRows(limit: number): Promise<LeaderboardRow[]> {
  try {
    return await getCachedLeaderboardRows(limit);
  } catch {
    const result = await loadLeaderboardRows(limit);
    if (result.error) console.error("[leaderboard]", result.error);
    return result.rows;
  }
}

/** Bảng xếp hạng chung, giống nhau với mọi người xem (trang /leaderboard được cache ISR). */
export async function getLeaderboardEntries(limit = 45): Promise<LeaderboardEntry[]> {
  try {
    return mapRows(await getLeaderboardRows(limit));
  } catch (err) {
    console.error("[leaderboard] fatal:", err);
    return [];
  }
}

/**
 * Hạng / điểm của người đang đăng nhập. Đọc cookie nên chỉ gọi từ route động
 * (/api/leaderboard/me), không bao giờ cache chung giữa các người dùng.
 */
export async function getMyLeaderboardPosition(): Promise<MyLeaderboardPosition> {
  const result: MyLeaderboardPosition = {
    isGuest: true,
    currentUserId: null,
    currentEmployeeCode: null,
    currentRank: 0,
    currentScore: 0,
  };

  try {
    const publicDb = createPublicClient();
    const [supabase, userId] = await Promise.all([createClient(), getSessionUserId()]);
    result.isGuest = !userId;

    if (userId) {
      result.currentUserId = userId;
      const { data: profile } = await supabase
        .from(CDILV_TABLE.profiles)
        .select("employee_code, total_score, rank")
        .eq("id", userId)
        .maybeSingle();

      result.currentEmployeeCode = profile?.employee_code ?? null;

      if (profile?.rank && (profile.total_score ?? 0) > 0) {
        result.currentRank = Number(profile.rank);
        result.currentScore = profile.total_score ?? 0;
      } else {
        // Tra theo id và theo mã nhân viên song song; vẫn ưu tiên kết quả theo id như trước
        const [{ data: byId }, byCodeResult] = await Promise.all([
          publicDb
            .from(CDILV_TABLE.leaderboard)
            .select("total_score, rank, id, employee_code")
            .eq("id", userId)
            .maybeSingle(),
          result.currentEmployeeCode
            ? publicDb
                .from(CDILV_TABLE.leaderboard)
                .select("total_score, rank, id, employee_code")
                .eq("employee_code", result.currentEmployeeCode)
                .maybeSingle()
            : null,
        ]);

        const mine = byId ?? byCodeResult?.data ?? null;

        if (mine) {
          result.currentRank = Number(mine.rank);
          result.currentScore = mine.total_score;
        }
      }
    }
  } catch (authErr) {
    console.warn("[leaderboard] auth skipped:", authErr);
  }

  return result;
}
