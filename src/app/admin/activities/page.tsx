import { redirect } from "next/navigation";
import { AdminActivitiesManager } from "@/components/admin/AdminActivitiesManager";
import { getSessionUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { getActivities } from "@/lib/data/activities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminActivitiesPage() {
  const [supabase, userId] = await Promise.all([createClient(), getSessionUserId()]);

  if (!userId) {
    redirect("/login?next=/admin/activities");
  }

  const [{ data: me }, activities] = await Promise.all([
    supabase
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status")
      .eq("id", userId)
      .maybeSingle(),
    getActivities(undefined, { includeHidden: true }),
  ]);

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  return <AdminActivitiesManager activities={activities} />;
}
