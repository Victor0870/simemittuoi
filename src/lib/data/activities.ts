import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { isScheduledAt } from "@/lib/post-schedule";

const ACTIVITY_COLUMNS =
  "id, title, description, location, event_date, points, image_url, image_alt, is_registration_open, is_active, published_at, created_at";

/**
 * includeHidden: kèm hoạt động Inactive / hẹn giờ (chỉ dùng ở trang quản trị / xem trước của admin).
 * includeParticipants: kèm danh sách người đăng ký đầy đủ — chỉ truyền true khi người xem là admin.
 */
type ActivityQueryOptions = { includeHidden?: boolean; includeParticipants?: boolean };

const PARTICIPANT_COLUMNS =
  "id, activity_id, user_id, registered_at, cdilv_profiles(id, full_name, avatar_url, employee_code, department, role)";

function mapParticipant(r: any): ActivityParticipant {
  const prof = Array.isArray(r.cdilv_profiles) ? r.cdilv_profiles[0] : r.cdilv_profiles;
  return {
    id: r.id,
    userId: r.user_id,
    fullName: prof?.full_name || "Đoàn viên",
    avatarUrl: prof?.avatar_url || null,
    employeeCode: prof?.employee_code || null,
    department: prof?.department || null,
    role: prof?.role || "user",
    registeredAt: r.registered_at,
    timeAgo: formatTimeAgo(r.registered_at),
  };
}

export type ActivityParticipant = {
  id: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  employeeCode: string | null;
  department: string | null;
  role: string;
  registeredAt: string;
  timeAgo: string;
};

export type ActivityDetail = {
  id: string;
  title: string;
  description: string | null;
  location: string;
  eventDate: string | null;
  dateLabel: string;
  points: number;
  imageUrl: string | null;
  imageAlt: string | null;
  isRegistrationOpen: boolean;
  isActive: boolean;
  /** Thời điểm bắt đầu hiển thị; ở tương lai = hoạt động hẹn giờ. */
  publishedAt: string;
  isScheduled: boolean;
  createdAt: string;
  participantCount: number;
  participants: ActivityParticipant[];
  isRegistered?: boolean;
};

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hôm qua";
  return `${days} ngày trước`;
}

function formatDate(date: string | null): string {
  if (!date) return "";
  const parsed = new Date(date);
  return parsed.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export async function getActivities(
  userId?: string,
  options?: ActivityQueryOptions,
): Promise<ActivityDetail[]> {
  const db = createServiceClient();

  let activitiesQuery = db
    .from(CDILV_TABLE.activities)
    .select(ACTIVITY_COLUMNS)
    .order("created_at", { ascending: false });
  if (!options?.includeHidden) {
    activitiesQuery = activitiesQuery.eq("is_active", true).lte("published_at", new Date().toISOString());
  }

  const [activitiesRes, countsRes, userRegistrationsRes] = await Promise.all([
    activitiesQuery,
    createPublicClient()
      .from(CDILV_TABLE.activityParticipantCounts)
      .select("activity_id, participant_count"),
    userId
      ? db
          .from(CDILV_TABLE.activityRegistrations)
          .select("activity_id")
          .eq("user_id", userId)
      : Promise.resolve({ data: [] as Array<{ activity_id: string }> }),
  ]);

  if (activitiesRes.error) {
    console.error("[activities] getActivities error:", activitiesRes.error.message);
    return [];
  }
  if (countsRes.error) {
    console.error("[activities] participant counts error:", countsRes.error.message);
  }

  const countMap = new Map<string, number>();
  for (const c of countsRes.data ?? []) {
    countMap.set(c.activity_id, Number(c.participant_count) || 0);
  }

  const userRegisteredSet = new Set<string>(
    (userRegistrationsRes.data ?? []).map((r) => r.activity_id),
  );

  return (activitiesRes.data ?? []).map((row: any) => {
    return {
      id: row.id,
      title: row.title,
      description: row.description || null,
      location: row.location || "",
      eventDate: row.event_date || null,
      dateLabel: formatDate(row.event_date),
      points: row.points ?? 0,
      imageUrl: row.image_url || null,
      imageAlt: row.image_alt || row.title,
      isRegistrationOpen: row.is_registration_open !== false,
      isActive: row.is_active !== false,
      publishedAt: row.published_at ?? row.created_at,
      isScheduled: isScheduledAt(row.published_at ?? row.created_at),
      createdAt: row.created_at,
      participantCount: countMap.get(row.id) ?? 0,
      participants: [],
      isRegistered: userId ? userRegisteredSet.has(row.id) : false,
    };
  });
}

export async function getActivityById(
  id: string,
  userId?: string,
  options?: ActivityQueryOptions,
): Promise<ActivityDetail | null> {
  const db = createServiceClient();

  let activityQuery = db.from(CDILV_TABLE.activities).select(ACTIVITY_COLUMNS).eq("id", id);
  if (!options?.includeHidden) {
    activityQuery = activityQuery.eq("is_active", true).lte("published_at", new Date().toISOString());
  }

  // Người thường chỉ nhận số lượng + dòng đăng ký của chính mình; danh sách đầy đủ chỉ dành cho admin.
  const registrationsQuery = options?.includeParticipants
    ? db
        .from(CDILV_TABLE.activityRegistrations)
        .select(PARTICIPANT_COLUMNS)
        .eq("activity_id", id)
        .order("registered_at", { ascending: true })
    : userId
      ? db
          .from(CDILV_TABLE.activityRegistrations)
          .select(PARTICIPANT_COLUMNS)
          .eq("activity_id", id)
          .eq("user_id", userId)
      : Promise.resolve({ data: [] as any[] });

  const [actRes, countRes, regsRes] = await Promise.all([
    activityQuery.maybeSingle(),
    createPublicClient()
      .from(CDILV_TABLE.activityParticipantCounts)
      .select("participant_count")
      .eq("activity_id", id)
      .maybeSingle(),
    registrationsQuery,
  ]);

  if (actRes.error) {
    console.error("[activities] getActivityById error:", actRes.error.message);
    return null;
  }
  if (!actRes.data) return null;

  const row = actRes.data as any;
  const participants: ActivityParticipant[] = (regsRes.data ?? []).map(mapParticipant);
  const participantCount = options?.includeParticipants
    ? participants.length
    : Number(countRes.data?.participant_count) || 0;
  const isUserRegistered = userId ? participants.some((p) => p.userId === userId) : false;

  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    location: row.location || "",
    eventDate: row.event_date || null,
    dateLabel: formatDate(row.event_date),
    points: row.points ?? 0,
    imageUrl: row.image_url || null,
    imageAlt: row.image_alt || row.title,
    isRegistrationOpen: row.is_registration_open !== false,
    isActive: row.is_active !== false,
    publishedAt: row.published_at ?? row.created_at,
    isScheduled: isScheduledAt(row.published_at ?? row.created_at),
    createdAt: row.created_at,
    participantCount,
    participants,
    isRegistered: isUserRegistered,
  };
}
