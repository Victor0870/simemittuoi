import { redirect } from "next/navigation";
import type {
  AdminActivityItem,
  AdminProfileItem,
  AdminScoreEventItem,
  AdminWhitelistItem,
} from "@/components/admin/AdminScoresManager";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type AdminScoresData = {
  currentAdminName: string;
  profiles: AdminProfileItem[];
  activities: AdminActivityItem[];
  recentEvents: AdminScoreEventItem[];
  whitelist: AdminWhitelistItem[];
  /** Lịch sử chạm trần HISTORY_MAX_ROWS dòng (chỉ khi gọi với historyFrom). */
  historyCapped: boolean;
};

export const HISTORY_MAX_ROWS = 5000;
const HISTORY_PAGE_SIZE = 1000;

type ScoreEventRow = AdminScoreEventItem;

export type LoadScoresOptions = {
  /** Chỉ trang Lịch sử: "YYYY-MM-DD" (từ 00:00 giờ Việt Nam) hoặc "all"; thay limit(50) bằng tối đa 5.000 dòng. */
  historyFrom?: string | null;
};

/** Kiểm tra quyền admin và tải dữ liệu chung cho 3 trang điểm thi đua; `nextPath` là trang quay lại sau đăng nhập. */
export async function loadScoresData(nextPath: string, options?: LoadScoresOptions): Promise<AdminScoresData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${nextPath}`);
  }

  const { data: me } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("id, full_name, role, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  // 1. Load all approved profiles
  const { data: profilesData } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("id, full_name, employee_code, department, avatar_url, total_score, rank, approval_status")
    .eq("approval_status", "approved")
    .order("total_score", { ascending: false });

  // 2. Load activities
  const { data: activitiesData } = await supabase
    .from(CDILV_TABLE.activities)
    .select("id, title, points, event_date")
    .order("event_date", { ascending: false });

  // 3. Load recent score events
  const historyFrom = options?.historyFrom;
  let eventsData: ScoreEventRow[] | null;
  if (historyFrom) {
    const fromIso = historyFrom === "all" ? null : new Date(`${historyFrom}T00:00:00+07:00`).toISOString();
    eventsData = [];
    for (let from = 0; from < HISTORY_MAX_ROWS; from += HISTORY_PAGE_SIZE) {
      let query = supabase
        .from(CDILV_TABLE.scoreEvents)
        .select("id, user_id, points, note, award_label, activity_id, created_at, created_by, employee_code");
      if (fromIso) query = query.gte("created_at", fromIso);
      const { data: page } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, Math.min(from + HISTORY_PAGE_SIZE, HISTORY_MAX_ROWS) - 1);
      eventsData.push(...((page ?? []) as ScoreEventRow[]));
      if (!page || page.length < HISTORY_PAGE_SIZE) break;
    }
  } else {
    ({ data: eventsData } = await supabase
      .from(CDILV_TABLE.scoreEvents)
      .select("id, user_id, points, note, award_label, activity_id, created_at, created_by, employee_code")
      .order("created_at", { ascending: false })
      .limit(50));
  }

  // 4. Load employee whitelist (for matching employees without accounts yet)
  const { data: whitelistData } = await supabase
    .from(CDILV_TABLE.employeeWhitelist)
    .select("employee_code, full_name, department")
    .eq("is_active", true)
    .order("employee_code", { ascending: true });

  const profiles: AdminProfileItem[] = (profilesData ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    employee_code: p.employee_code,
    department: p.department,
    avatar_url: p.avatar_url,
    total_score: p.total_score ?? 0,
    rank: p.rank,
    approval_status: p.approval_status,
  }));

  const activities: AdminActivityItem[] = (activitiesData ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    points: a.points ?? 0,
    event_date: a.event_date,
  }));

  const recentEvents: AdminScoreEventItem[] = (eventsData ?? []).map((e) => ({
    id: e.id,
    user_id: e.user_id,
    employee_code: e.employee_code,
    points: e.points,
    note: e.note,
    award_label: e.award_label,
    activity_id: e.activity_id,
    created_at: e.created_at,
    created_by: e.created_by,
  }));

  const whitelist: AdminWhitelistItem[] = (whitelistData ?? []).map((w) => ({
    employee_code: w.employee_code,
    full_name: w.full_name,
    department: w.department,
  }));

  return {
    currentAdminName: me.full_name || "Quản trị viên",
    profiles,
    activities,
    recentEvents,
    whitelist,
    historyCapped: Boolean(historyFrom) && recentEvents.length >= HISTORY_MAX_ROWS,
  };
}
