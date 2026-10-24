import { unstable_cache } from "next/cache";
import type { LeaderboardEntry } from "@/lib/mock-data";
import { getSessionUserId } from "@/lib/auth/session";
import { refreshLeaderboardIfStale } from "@/lib/data/ranking-refresh";
import { LEADERBOARD_CACHE_TAG, RANKING_REVALIDATE_SECONDS } from "@/lib/ranking-cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type LeaderboardPageData = {
  entries: LeaderboardEntry[];
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
  const publicDb = createPublicClient();
  const { data, error } = await publicDb
    .from(CDILV_TABLE.leaderboard)
    .select(
      "id, full_name, department, avatar_url, employee_code, total_score, rank",
    )
    .order("rank", { ascending: true })
    .limit(limit);

  if (!error && data?.length) return { rows: data, error: null };

  const cache = await publicDb
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

export async function getLeaderboardPageData(
  limit = 45,
): Promise<LeaderboardPageData> {
  const empty: LeaderboardPageData = {
    entries: [],
    isGuest: true,
    currentUserId: null,
    currentEmployeeCode: null,
    currentRank: 0,
    currentScore: 0,
  };

  try {
    const publicDb = createPublicClient();

    let isGuest = true;
    let currentUserId: string | null = null;
    let currentEmployeeCode: string | null = null;
    let currentRank = 0;
    let currentScore = 0;

    // Bảng xếp hạng chung và thông tin của người đang đăng nhập không phụ thuộc nhau: tải song song
    const loadMine = async () => {
      try {
        const [supabase, userId] = await Promise.all([createClient(), getSessionUserId()]);
        isGuest = !userId;

        if (userId) {
          currentUserId = userId;
          const { data: profile } = await supabase
            .from(CDILV_TABLE.profiles)
            .select("employee_code, total_score, rank")
            .eq("id", userId)
            .maybeSingle();

          currentEmployeeCode = profile?.employee_code ?? null;

          if (profile?.rank && (profile.total_score ?? 0) > 0) {
            currentRank = Number(profile.rank);
            currentScore = profile.total_score ?? 0;
          } else {
            const { data: byId } = await publicDb
              .from(CDILV_TABLE.leaderboard)
              .select("total_score, rank, id, employee_code")
              .eq("id", userId)
              .maybeSingle();

            let mine = byId;
            if (!mine && currentEmployeeCode) {
              const { data: byCode } = await publicDb
                .from(CDILV_TABLE.leaderboard)
                .select("total_score, rank, id, employee_code")
                .eq("employee_code", currentEmployeeCode)
                .maybeSingle();
              mine = byCode;
            }

            if (mine) {
              currentRank = Number(mine.rank);
              currentScore = mine.total_score;
            }
          }
        }
      } catch (authErr) {
        console.warn("[leaderboard] auth skipped:", authErr);
      }
    };

    const [rows] = await Promise.all([getLeaderboardRows(limit), loadMine()]);
    const entries = mapRows(rows);

    return {
      entries,
      isGuest,
      currentUserId,
      currentEmployeeCode,
      currentRank,
      currentScore,
    };
  } catch (err) {
    console.error("[leaderboard] fatal:", err);
    return empty;
  }
}
