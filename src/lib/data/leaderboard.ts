import type { LeaderboardEntry } from "@/lib/mock-data";
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

function mapRows(
  rows: Array<{
    id: string | null;
    full_name: string;
    department: string | null;
    avatar_url: string | null;
    employee_code: string | null;
    total_score: number;
    rank: number | string;
  }>,
): LeaderboardEntry[] {
  return rows.map((row, index) => ({
    id: row.id ?? row.employee_code ?? `rank-${row.rank}`,
    rank: Number(row.rank),
    name: row.full_name,
    department: row.department ?? "",
    score: Number(row.total_score) || 0,
    avatarUrl: row.avatar_url ?? "",
    isTop: index === 0 || Number(row.rank) === 1,
  }));
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
    let { data: rows, error } = await publicDb
      .from(CDILV_TABLE.leaderboard)
      .select(
        "id, full_name, department, avatar_url, employee_code, total_score, rank",
      )
      .order("rank", { ascending: true })
      .limit(limit);

    if (error || !rows?.length) {
      const cache = await publicDb
        .from(CDILV_TABLE.leaderboardCache)
        .select(
          "id, full_name, department, avatar_url, employee_code, total_score, rank",
        )
        .gt("total_score", 0)
        .order("rank", { ascending: true })
        .limit(limit);
      if (!cache.error && cache.data?.length) {
        rows = cache.data;
      } else if (error) {
        console.error("[leaderboard]", error.message);
      }
    }

    const entries = mapRows(rows ?? []);

    let isGuest = true;
    let currentUserId: string | null = null;
    let currentEmployeeCode: string | null = null;
    let currentRank = 0;
    let currentScore = 0;

    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      isGuest = !user;

      if (user) {
        currentUserId = user.id;
        const { data: profile } = await supabase
          .from(CDILV_TABLE.profiles)
          .select("employee_code, total_score, rank")
          .eq("id", user.id)
          .maybeSingle();

        currentEmployeeCode = profile?.employee_code ?? null;

        if (profile?.rank && (profile.total_score ?? 0) > 0) {
          currentRank = Number(profile.rank);
          currentScore = profile.total_score ?? 0;
        } else {
          const { data: byId } = await publicDb
            .from(CDILV_TABLE.leaderboard)
            .select("total_score, rank, id, employee_code")
            .eq("id", user.id)
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
