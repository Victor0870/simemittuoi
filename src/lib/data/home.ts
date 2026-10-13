import type {
  Activity,
  Announcement,
  LeaderboardEntry,
} from "@/lib/mock-data";
import { MOCK_GOAL } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type DashboardUser = {
  name: string;
  score: number;
  rank: number;
  newActivitiesCount: number;
};

export type HomePageData = {
  user: DashboardUser;
  announcements: Announcement[];
  newsPosts: Announcement[];
  activities: Activity[];
  leaderboard: LeaderboardEntry[];
  goal: typeof MOCK_GOAL;
  dataSource: "supabase" | "empty" | "error";
  /** true = chưa đăng nhập (khách) */
  isGuest: boolean;
  errorMessage?: string;
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

function emptyUser(isGuest: boolean): DashboardUser {
  return {
    name: isGuest ? "Khách" : "Đoàn viên",
    score: 0,
    rank: 0,
    newActivitiesCount: 0,
  };
}

export async function getHomePageData(): Promise<HomePageData> {
  try {
    const publicDb = createPublicClient();

    const [postsResult, activitiesResult, leaderboardResult, registrationsResult] =
      await Promise.all([
        publicDb
          .from(CDILV_TABLE.posts)
          .select("id, title, content, tag, tag_tone, is_important, is_active, published_at")
          .eq("is_active", true)
          .order("published_at", { ascending: false })
          .limit(10),
        publicDb
          .from(CDILV_TABLE.activities)
          .select(
            "id, title, description, location, event_date, points, image_url, image_alt, is_registration_open",
          )
          .order("event_date", { ascending: false })
          .limit(4),
        publicDb
          .from(CDILV_TABLE.leaderboard)
          .select(
            "id, full_name, department, avatar_url, employee_code, total_score, rank",
          )
          .order("rank", { ascending: true })
          .limit(10),
        publicDb
          .from(CDILV_TABLE.activityRegistrations)
          .select("id, activity_id, user_id"),
      ]);

    const errors = [
      postsResult.error?.message,
      activitiesResult.error?.message,
      leaderboardResult.error?.message,
    ].filter(Boolean);

    if (errors.length) {
      console.error("[home] supabase errors:", errors.join(" | "));
    }

    const posts = postsResult.data ?? [];
    const activities = activitiesResult.data ?? [];
    const allRegistrations = registrationsResult.data ?? [];
    let leaderboardRows = leaderboardResult.data ?? [];

    // Fallback cache nếu view lỗi
    if (leaderboardResult.error || leaderboardRows.length === 0) {
      const cache = await publicDb
        .from(CDILV_TABLE.leaderboardCache)
        .select(
          "id, full_name, department, avatar_url, employee_code, total_score, rank",
        )
        .gt("total_score", 0)
        .order("rank", { ascending: true })
        .limit(10);
      if (!cache.error && cache.data?.length) {
        leaderboardRows = cache.data;
      }
    }

    const allMappedPosts: Announcement[] = posts.map((post) => ({
      id: post.id,
      tag: post.tag ?? "Thông báo",
      tagTone: post.tag_tone === "error" ? "error" : "primary",
      timeAgo: formatTimeAgo(post.published_at),
      title: post.title,
      excerpt: post.content,
      isImportant: Boolean(post.is_important),
    }));

    // Chỉ những bài nào được Admin đánh dấu là Quan trọng mới đưa vào announcements
    const announcements = allMappedPosts.filter((p) => p.isImportant).slice(0, 4);

    // Các bài viết còn lại đưa vào mục tin tức thường
    const newsPosts = allMappedPosts.filter((p) => !p.isImportant).slice(0, 4);

    let authUser: any = null;

    const leaderboard: LeaderboardEntry[] = leaderboardRows
      .slice(0, 6)
      .map((row, index) => ({
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

    let isGuest = true;
    let user = emptyUser(true);

    try {
      const supabase = await createClient();
      const authResult = await supabase.auth.getUser();
      const authUser = authResult.data.user;
      isGuest = !authUser;
      user = emptyUser(isGuest);

      if (authUser) {
        const { data: profile } = await supabase
          .from(CDILV_TABLE.profiles)
          .select("full_name, employee_code, total_score, rank")
          .eq("id", authUser.id)
          .maybeSingle();

        let score = profile?.total_score ?? 0;
        let rank = profile?.rank ? Number(profile.rank) : 0;

        if (!rank && score === 0) {
          const { data: byId } = await publicDb
            .from(CDILV_TABLE.leaderboard)
            .select("total_score, rank")
            .eq("id", authUser.id)
            .maybeSingle();

          let myRank = byId;
          if (!myRank && profile?.employee_code) {
            const { data: byCode } = await publicDb
              .from(CDILV_TABLE.leaderboard)
              .select("total_score, rank")
              .eq("employee_code", profile.employee_code)
              .maybeSingle();
            myRank = byCode;
          }

          if (myRank) {
            score = myRank.total_score ?? 0;
            rank = myRank.rank ? Number(myRank.rank) : 0;
          }
        }

        user = {
          name: profile?.full_name ?? "Đoàn viên",
          score,
          rank,
          newActivitiesCount: activities.length,
        };
      }
    } catch (authErr) {
      console.warn("[home] auth session skipped:", authErr);
    }

    const activityItems: Activity[] = activities.map((item) => {
      const actRegs = allRegistrations.filter((r: any) => r.activity_id === item.id);
      const isUserRegistered = authUser ? actRegs.some((r: any) => r.user_id === authUser.id) : false;

      return {
        id: item.id,
        title: item.title,
        description: item.description ?? "",
        date: formatDate(item.event_date),
        location: item.location ?? "",
        points: item.points,
        imageUrl: item.image_url ?? "",
        imageAlt: item.image_alt ?? item.title,
        participantAvatars: [],
        extraParticipants: 0,
        isRegistrationOpen: item.is_registration_open !== false,
        participantCount: actRegs.length,
        isRegistered: isUserRegistered,
      };
    });

    const hasContent =
      announcements.length > 0 ||
      activityItems.length > 0 ||
      leaderboard.length > 0;

    return {
      user,
      announcements,
      newsPosts,
      activities: activityItems.slice(0, 4),
      leaderboard,
      goal: MOCK_GOAL,
      dataSource: hasContent ? "supabase" : errors.length ? "error" : "empty",
      isGuest,
      errorMessage: errors.length ? errors.join(" | ") : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[home] fatal:", message);
    return {
      user: emptyUser(true),
      announcements: [],
      newsPosts: [],
      activities: [],
      leaderboard: [],
      goal: MOCK_GOAL,
      dataSource: "error",
      isGuest: true,
      errorMessage: message,
    };
  }
}
