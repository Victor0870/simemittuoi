import { redirect } from "next/navigation";
import { SpendingRegulationEditor } from "@/components/admin/SpendingRegulationEditor";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadSpendingRegulation } from "@/lib/finance/regulation-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSpendingRegulationPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/finance/regulations");
  if (!hasPermission(access, PERMISSIONS.financeManage)) redirect("/");

  const { regulation, updatedAt } = await loadSpendingRegulation(createServiceClient());
  return <SpendingRegulationEditor initial={regulation} updatedAt={updatedAt} />;
}
