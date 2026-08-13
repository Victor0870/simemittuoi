import type { LeaderboardEntry } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";

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
    score: row.total_score,
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
    const supabase = await createClient();
    const [leaderboardResult, authResult] = await Promise.all([
      supabase
        .from("leaderboard")
        .select(
          "id, full_name, department, avatar_url, employee_code, total_score, rank",
        )
        .order("rank", { ascending: true })
        .limit(limit),
      supabase.auth.getUser(),
    ]);

    const user = authResult.data.user;
    const isGuest = !user;
    const rows = leaderboardResult.data ?? [];
    const entries = mapRows(rows);

    let currentUserId: string | null = null;
    let currentEmployeeCode: string | null = null;
    let currentRank = 0;
    let currentScore = 0;

    if (user) {
      currentUserId = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_code")
        .eq("id", user.id)
        .maybeSingle();

      currentEmployeeCode = profile?.employee_code ?? null;

      const mine = rows.find(
        (row) =>
          row.id === user.id ||
          (currentEmployeeCode &&
            row.employee_code &&
            String(row.employee_code).toUpperCase() ===
              String(currentEmployeeCode).toUpperCase()),
      );

      if (mine) {
        currentRank = Number(mine.rank);
        currentScore = mine.total_score;
      }
    }

    return {
      entries,
      isGuest,
      currentUserId,
      currentEmployeeCode,
      currentRank,
      currentScore,
    };
  } catch {
    return empty;
  }
}
