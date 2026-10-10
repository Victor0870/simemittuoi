import { redirect } from "next/navigation";
import { AdminActivitiesManager } from "@/components/admin/AdminActivitiesManager";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { getActivities } from "@/lib/data/activities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminActivitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/activities");
  }

  const { data: me } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  const activities = await getActivities();

  return <AdminActivitiesManager activities={activities} />;
}
