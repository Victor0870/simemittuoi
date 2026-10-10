import { redirect } from "next/navigation";
import { AdminPollsManager } from "@/components/admin/AdminPollsManager";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { getPolls } from "@/lib/data/polls";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPollsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/polls");
  }

  const { data: me } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("role, approval_status, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  const polls = await getPolls();

  return (
    <AdminPollsManager
      currentAdminName={me.full_name || "Quản trị viên"}
      polls={polls}
    />
  );
}
