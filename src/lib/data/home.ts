import type {
  Activity,
  Announcement,
  LeaderboardEntry,
} from "@/lib/mock-data";
import {
  MOCK_ACTIVITIES,
  MOCK_ANNOUNCEMENTS,
  MOCK_GOAL,
  MOCK_USER,
} from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";

export type DashboardUser = {
  name: string;
  score: number;
  rank: number;
  newActivitiesCount: number;
};

export type HomePageData = {
  user: DashboardUser;
  announcements: Announcement[];
  activities: Activity[];
  leaderboard: LeaderboardEntry[];
  goal: typeof MOCK_GOAL;
  dataSource: "supabase" | "mock";
  /** true = chưa đăng nhập (khách) */
  isGuest: boolean;
};

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  if (hours < 1) return "Vừa xong";
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Hôm qua";
  return `${days} ngày trước`;
}

function formatDate(date: string | null): string {
  if (!date) return "";
  const parsed = new Date(date);
  return parsed.toLocaleDateString("vi-VN");
}

function fallbackData(isGuest: boolean): HomePageData {
  return {
    user: MOCK_USER,
    announcements: MOCK_ANNOUNCEMENTS,
    activities: MOCK_ACTIVITIES,
    leaderboard: [],
    goal: MOCK_GOAL,
    dataSource: "mock",
    isGuest,
  };
}

export async function getHomePageData(): Promise<HomePageData> {
  try {
    const supabase = await createClient();

    const [postsResult, activitiesResult, leaderboardResult, authResult] =
      await Promise.all([
        supabase
          .from("posts")
          .select("id, title, content, tag, tag_tone, published_at")
          .order("published_at", { ascending: false })
          .limit(10),
        supabase
          .from("activities")
          .select(
            "id, title, location, event_date, points, image_url, image_alt",
          )
          .order("event_date", { ascending: false })
          .limit(10),
        supabase
          .from("leaderboard")
          .select(
            "id, full_name, department, avatar_url, employee_code, total_score, rank",
          )
          .order("rank", { ascending: true })
          .limit(10),
        supabase.auth.getUser(),
      ]);

    const isGuest = !authResult.data.user;

    const hasDbError =
      postsResult.error || activitiesResult.error || leaderboardResult.error;

    const posts = postsResult.data ?? [];
    const activities = activitiesResult.data ?? [];
    const leaderboardRows = leaderboardResult.data ?? [];

    const hasContent =
      posts.length > 0 || activities.length > 0 || leaderboardRows.length > 0;

    if (hasDbError && !hasContent) {
      return fallbackData(isGuest);
    }

    // Nếu DB lỗi một phần nhưng còn leaderboard thì vẫn dùng leaderboard thật
    if (!hasContent) {
      return fallbackData(isGuest);
    }

    const announcements: Announcement[] =
      posts.length > 0
        ? posts.map((post) => ({
            id: post.id,
            tag: post.tag ?? "Thông báo",
            tagTone: post.tag_tone === "error" ? "error" : "primary",
            timeAgo: formatTimeAgo(post.published_at),
            title: post.title,
            excerpt: post.content,
          }))
        : MOCK_ANNOUNCEMENTS;

    const activityItems: Activity[] =
      activities.length > 0
        ? activities.map((item) => ({
            id: item.id,
            title: item.title,
            date: formatDate(item.event_date),
            location: item.location ?? "",
            points: item.points,
            imageUrl: item.image_url ?? "",
            imageAlt: item.image_alt ?? item.title,
            participantAvatars: [],
            extraParticipants: 0,
          }))
        : MOCK_ACTIVITIES;

    const leaderboard: LeaderboardEntry[] =
      leaderboardRows.length > 0
        ? leaderboardRows.slice(0, 10).map((row, index) => ({
            id: row.id ?? row.employee_code ?? `rank-${row.rank}`,
            rank: Number(row.rank),
            name: row.full_name,
            department: row.department ?? "",
            score: row.total_score,
            avatarUrl: row.avatar_url ?? "",
            isTop: index === 0,
          }))
        : [];

    // Không còn dùng MOCK_LEADERBOARD khi đã có dữ liệu điểm thật
    const miniLeaderboard =
      leaderboard.length > 0 ? leaderboard.slice(0, 5) : [];

    let user = {
      name: isGuest ? "Khách" : MOCK_USER.name,
      score: 0,
      rank: 0,
      newActivitiesCount: activityItems.length,
    };

    if (authResult.data.user) {
      const userId = authResult.data.user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, employee_code")
        .eq("id", userId)
        .maybeSingle();

      const myRank = leaderboardRows.find(
        (row) =>
          row.id === userId ||
          (profile?.employee_code &&
            row.employee_code &&
            String(row.employee_code).toUpperCase() ===
              String(profile.employee_code).toUpperCase()),
      );

      user = {
        name: profile?.full_name ?? MOCK_USER.name,
        score: myRank?.total_score ?? 0,
        rank: myRank ? Number(myRank.rank) : 0,
        newActivitiesCount: activityItems.length,
      };
    }

    return {
      user,
      announcements,
      activities: activityItems,
      leaderboard: miniLeaderboard,
      goal: MOCK_GOAL,
      dataSource: "supabase",
      isGuest,
    };
  } catch {
    return fallbackData(true);
  }
}
