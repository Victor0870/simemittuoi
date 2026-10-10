import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";

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

export async function getActivities(userId?: string): Promise<ActivityDetail[]> {
  const db = createPublicClient();

  const [activitiesRes, registrationsRes] = await Promise.all([
    db
      .from(CDILV_TABLE.activities)
      .select("id, title, description, location, event_date, points, image_url, image_alt, is_registration_open, created_at")
      .order("created_at", { ascending: false }),
    db
      .from(CDILV_TABLE.activityRegistrations)
      .select("id, activity_id, user_id, registered_at, cdilv_profiles(id, full_name, avatar_url, employee_code, department, role)")
      .order("registered_at", { ascending: true }),
  ]);

  if (activitiesRes.error) {
    console.error("[activities] getActivities error:", activitiesRes.error.message);
    return [];
  }

  const allRegistrations = registrationsRes.data ?? [];

  return (activitiesRes.data ?? []).map((row: any) => {
    const actRegs = allRegistrations.filter((r: any) => r.activity_id === row.id);
    const isUserRegistered = userId ? actRegs.some((r: any) => r.user_id === userId) : false;

    const participants: ActivityParticipant[] = actRegs.map((r: any) => {
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
    });

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
      createdAt: row.created_at,
      participantCount: actRegs.length,
      participants,
      isRegistered: isUserRegistered,
    };
  });
}

export async function getActivityById(
  id: string,
  userId?: string,
): Promise<ActivityDetail | null> {
  const db = createPublicClient();

  const [actRes, regsRes] = await Promise.all([
    db
      .from(CDILV_TABLE.activities)
      .select("id, title, description, location, event_date, points, image_url, image_alt, is_registration_open, created_at")
      .eq("id", id)
      .maybeSingle(),
    db
      .from(CDILV_TABLE.activityRegistrations)
      .select("id, activity_id, user_id, registered_at, cdilv_profiles(id, full_name, avatar_url, employee_code, department, role)")
      .eq("activity_id", id)
      .order("registered_at", { ascending: true }),
  ]);

  if (actRes.error || !actRes.data) {
    console.error("[activities] getActivityById error:", actRes.error?.message);
    return null;
  }

  const row = actRes.data;
  const regs = regsRes.data ?? [];
  const isUserRegistered = userId ? regs.some((r: any) => r.user_id === userId) : false;

  const participants: ActivityParticipant[] = regs.map((r: any) => {
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
  });

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
    createdAt: row.created_at,
    participantCount: regs.length,
    participants,
    isRegistered: isUserRegistered,
  };
}
