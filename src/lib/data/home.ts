import type {
  Activity,
  Announcement,
  LeaderboardEntry,
} from "@/lib/mock-data";
import { unstable_cache } from "next/cache";
import { MOCK_GOAL } from "@/lib/mock-data";
import { getSessionUserId } from "@/lib/auth/session";
import { refreshLeaderboardIfStale } from "@/lib/data/ranking-refresh";
import { LEADERBOARD_CACHE_TAG, RANKING_REVALIDATE_SECONDS } from "@/lib/ranking-cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { stripPostFormatting } from "@/lib/post-format";

const HOME_PUBLIC_CACHE_SECONDS = 30;

export type DashboardUser = {
  name: string;
  score: number;
  rank: number;
  newActivitiesCount: number;
};

/** Dữ liệu chung của trang chủ, giống nhau với mọi người xem (được cache ISR). */
export type HomePageData = {
  announcements: Announcement[];
  newsPosts: Announcement[];
  activities: Activity[];
  leaderboard: LeaderboardEntry[];
  goal: typeof MOCK_GOAL;
  dataSource: "supabase" | "empty" | "error";
  errorMessage?: string;
};

/** Phần riêng của từng người xem trang chủ, tải qua /api/home/session. */
export type HomeSessionInfo = {
  /** true = chưa đăng nhập (khách) */
  isGuest: boolean;
  user: DashboardUser;
  registeredActivityIds: string[];
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

export function emptyUser(isGuest: boolean): DashboardUser {
  return {
    name: isGuest ? "Khách" : "Đoàn viên",
    score: 0,
    rank: 0,
    newActivitiesCount: 0,
  };
}

type HomePublicData = {
  posts: Array<{
    id: string;
    title: string;
    content: string;
    tag: string | null;
    tag_tone: string | null;
    is_important: boolean | null;
    published_at: string;
  }>;
  activities: Array<{
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    event_date: string | null;
    points: number;
    image_url: string | null;
    image_alt: string | null;
    is_registration_open: boolean | null;
  }>;
  leaderboardRows: Array<{
    id: string | null;
    full_name: string;
    department: string | null;
    avatar_url: string | null;
    employee_code: string | null;
    total_score: number;
    rank: number | string;
  }>;
  errors: string[];
};

async function loadHomePublicData(): Promise<HomePublicData> {
  const publicDb = createPublicClient();

  const [postsResult, activitiesResult] = await Promise.all([
    publicDb
      .from(CDILV_TABLE.posts)
      .select("id, title, content, tag, tag_tone, is_important, is_active, published_at")
      .eq("is_active", true)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(10),
    publicDb
      .from(CDILV_TABLE.activities)
      .select(
        "id, title, description, location, event_date, points, image_url, image_alt, is_registration_open",
      )
      .order("event_date", { ascending: false })
      .limit(4),
  ]);

  const errors = [
    postsResult.error?.message,
    activitiesResult.error?.message,
  ].filter((msg): msg is string => Boolean(msg));

  return {
    posts: postsResult.data ?? [],
    activities: activitiesResult.data ?? [],
    leaderboardRows: [],
    errors,
  };
}

async function loadHomeLeaderboard(): Promise<Pick<HomePublicData, "leaderboardRows" | "errors">> {
  const publicDb = createPublicClient();
  const leaderboardResult = await publicDb
    .from(CDILV_TABLE.leaderboard)
    .select(
      "id, full_name, department, avatar_url, employee_code, total_score, rank",
    )
    .order("rank", { ascending: true })
    .limit(10);

  const errors = [leaderboardResult.error?.message].filter((msg): msg is string => Boolean(msg));

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

  return { leaderboardRows, errors };
}

const getCachedHomePublicData = unstable_cache(
  async () => {
    const data = await loadHomePublicData();
    // Không lưu cache kết quả lỗi, để lần sau truy vấn lại ngay
    if (data.errors.length) throw new Error(data.errors.join(" | "));
    return data;
  },
  ["home-public-data"],
  { revalidate: HOME_PUBLIC_CACHE_SECONDS, tags: ["home-public-data"] },
);

const getCachedHomeLeaderboard = unstable_cache(
  async () => {
    await refreshLeaderboardIfStale();
    const data = await loadHomeLeaderboard();
    if (data.errors.length) throw new Error(data.errors.join(" | "));
    return data;
  },
  ["home-leaderboard-rows"],
  { revalidate: RANKING_REVALIDATE_SECONDS, tags: [LEADERBOARD_CACHE_TAG] },
);

async function getHomePublicData(): Promise<HomePublicData> {
  const [main, board] = await Promise.all([
    getCachedHomePublicData().catch(() => loadHomePublicData()),
    getCachedHomeLeaderboard().catch(() => loadHomeLeaderboard()),
  ]);
  return {
    ...main,
    leaderboardRows: board.leaderboardRows,
    errors: [...main.errors, ...board.errors],
  };
}

/**
 * Thông tin riêng của người đang xem trang chủ (tên, điểm, hạng, hoạt động đã đăng ký).
 * Chỉ gọi từ route động (đọc cookie), không bao giờ cache chung giữa các người dùng.
 */
export async function getHomeSessionInfo(activityIds: string[]): Promise<HomeSessionInfo> {
  const guest: HomeSessionInfo = {
    isGuest: true,
    user: emptyUser(true),
    registeredActivityIds: [],
  };
  try {
    const [supabase, authUserId] = await Promise.all([createClient(), getSessionUserId()]);
    if (!authUserId) return guest;

    const publicDb = createPublicClient();
    const [{ data: profile }, registrationsResult] = await Promise.all([
      supabase
        .from(CDILV_TABLE.profiles)
        .select("full_name, employee_code, total_score, rank")
        .eq("id", authUserId)
        .maybeSingle(),
      activityIds.length
        ? publicDb
            .from(CDILV_TABLE.activityRegistrations)
            .select("activity_id")
            .eq("user_id", authUserId)
            .in("activity_id", activityIds)
        : Promise.resolve({ data: [] as Array<{ activity_id: string }> }),
    ]);

    let score = profile?.total_score ?? 0;
    let rank = profile?.rank ? Number(profile.rank) : 0;

    if (!rank && score === 0) {
      const { data: byId } = await publicDb
        .from(CDILV_TABLE.leaderboard)
        .select("total_score, rank")
        .eq("id", authUserId)
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

    return {
      isGuest: false,
      user: {
        name: profile?.full_name ?? "Đoàn viên",
        score,
        rank,
        newActivitiesCount: activityIds.length,
      },
      registeredActivityIds: (registrationsResult.data ?? []).map((r) => r.activity_id),
    };
  } catch (authErr) {
    console.warn("[home] auth session skipped:", authErr);
    return guest;
  }
}

export async function getHomePageData(): Promise<HomePageData> {
  try {
    const publicDb = createPublicClient();
    const { posts, activities, leaderboardRows, errors } = await getHomePublicData();

    if (errors.length) {
      console.error("[home] supabase errors:", errors.join(" | "));
    }

    const activityIds = activities.map((item) => item.id);
    const registrationsResult = activityIds.length
      ? await publicDb
          .from(CDILV_TABLE.activityRegistrations)
          .select("activity_id")
          .in("activity_id", activityIds)
      : { data: [] as Array<{ activity_id: string }> };

    const allRegistrations = registrationsResult.data ?? [];

    const allMappedPosts: Announcement[] = posts.map((post) => ({
      id: post.id,
      tag: post.tag ?? "Thông báo",
      tagTone: post.tag_tone === "error" ? "error" : "primary",
      timeAgo: formatTimeAgo(post.published_at),
      title: post.title,
      excerpt: stripPostFormatting(post.content),
      isImportant: Boolean(post.is_important),
    }));

    // Chỉ những bài nào được Admin đánh dấu là Quan trọng mới đưa vào announcements
    const announcements = allMappedPosts.filter((p) => p.isImportant).slice(0, 4);

    // Các bài viết còn lại đưa vào mục tin tức thường
    const newsPosts = allMappedPosts.filter((p) => !p.isImportant).slice(0, 4);

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

    const activityItems: Activity[] = activities.map((item) => {
      const actRegs = allRegistrations.filter((r) => r.activity_id === item.id);

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
        isRegistered: false,
      };
    });

    const hasContent =
      announcements.length > 0 ||
      activityItems.length > 0 ||
      leaderboard.length > 0;

    return {
      announcements,
      newsPosts,
      activities: activityItems.slice(0, 4),
      leaderboard,
      goal: MOCK_GOAL,
      dataSource: hasContent ? "supabase" : errors.length ? "error" : "empty",
      errorMessage: errors.length ? errors.join(" | ") : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[home] fatal:", message);
    return {
      announcements: [],
      newsPosts: [],
      activities: [],
      leaderboard: [],
      goal: MOCK_GOAL,
      dataSource: "error",
      errorMessage: message,
    };
  }
}
