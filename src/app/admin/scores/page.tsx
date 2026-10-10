import { redirect } from "next/navigation";
import {
  AdminScoresManager,
  type AdminActivityItem,
  type AdminProfileItem,
  type AdminScoreEventItem,
  type AdminWhitelistItem,
} from "@/components/admin/AdminScoresManager";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminScoresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/scores");
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
  const { data: eventsData } = await supabase
    .from(CDILV_TABLE.scoreEvents)
    .select("id, user_id, points, note, award_label, activity_id, created_at, created_by, employee_code")
    .order("created_at", { ascending: false })
    .limit(50);

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

  return (
    <AdminScoresManager
      activities={activities}
      currentAdminId={me.id}
      currentAdminName={me.full_name || "Quản trị viên"}
      profiles={profiles}
      recentEvents={recentEvents}
      whitelist={whitelist}
    />
  );
}
