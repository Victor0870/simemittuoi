import { redirect } from "next/navigation";
import { AdminPollsManager } from "@/components/admin/AdminPollsManager";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { getPolls } from "@/lib/data/polls";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPollsPage() {
  const access = await getCurrentAccess();
  if (!access) {
    redirect("/login?next=/admin/polls");
  }
  if (!hasPermission(access, PERMISSIONS.pollsManage)) {
    redirect("/");
  }

  const supabase = await createClient();
  const [{ data: me }, polls] = await Promise.all([
    supabase
      .from(CDILV_TABLE.profiles)
      .select("full_name")
      .eq("id", access.userId)
      .maybeSingle(),
    getPolls(true),
  ]);

  return (
    <AdminPollsManager
      currentAdminName={me?.full_name || "Quản trị viên"}
      isAdmin={access.isAdmin}
      polls={polls}
    />
  );
}
