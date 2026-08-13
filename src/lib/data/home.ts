import type {
  Activity,
  Announcement,
  LeaderboardEntry,
} from "@/lib/mock-data";
import {
  MOCK_ACTIVITIES,
  MOCK_ANNOUNCEMENTS,
  MOCK_GOAL,
  MOCK_LEADERBOARD,
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
    leaderboard: MOCK_LEADERBOARD,
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
          .select("id, full_name, department, avatar_url, total_score, rank")
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

    if (hasDbError || (posts.length === 0 && activities.length === 0)) {
      return fallbackData(isGuest);
    }

    const announcements: Announcement[] = posts.map((post) => ({
      id: post.id,
      tag: post.tag ?? "Thông báo",
      tagTone: post.tag_tone === "error" ? "error" : "primary",
      timeAgo: formatTimeAgo(post.published_at),
      title: post.title,
      excerpt: post.content,
    }));

    const activityItems: Activity[] = activities.map((item) => ({
      id: item.id,
      title: item.title,
      date: formatDate(item.event_date),
      location: item.location ?? "",
      points: item.points,
      imageUrl: item.image_url ?? "",
      imageAlt: item.image_alt ?? item.title,
      participantAvatars: [],
      extraParticipants: 0,
    }));

    const leaderboard: LeaderboardEntry[] =
      leaderboardRows.length > 0
        ? leaderboardRows.slice(0, 2).map((row, index) => ({
            id: row.id,
            rank: Number(row.rank),
            name: row.full_name,
            department: row.department ?? "",
            score: row.total_score,
            avatarUrl: row.avatar_url ?? "",
            isTop: index === 0,
          }))
        : MOCK_LEADERBOARD;

    let user = { ...MOCK_USER };

    if (authResult.data.user) {
      const userId = authResult.data.user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      const myRank = leaderboardRows.find((row) => row.id === userId);

      user = {
        name: profile?.full_name ?? MOCK_USER.name,
        score: myRank?.total_score ?? 0,
        rank: myRank ? Number(myRank.rank) : 0,
        newActivitiesCount: activities.length,
      };
    }

    return {
      user,
      announcements:
        announcements.length > 0 ? announcements : MOCK_ANNOUNCEMENTS,
      activities: activityItems.length > 0 ? activityItems : MOCK_ACTIVITIES,
      leaderboard,
      goal: MOCK_GOAL,
      dataSource: "supabase",
      isGuest,
    };
  } catch {
    return fallbackData(true);
  }
}
