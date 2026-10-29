import { redirect } from "next/navigation";
import { SavingsManagement } from "@/components/finance/SavingsManagement";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadEntries, loadFunds, loadSavingsMonthlyRates } from "@/lib/finance/server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SavingsManagementPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/finance/savings");

  const canView = hasPermission(access, PERMISSIONS.financeView);
  if (!canView) redirect("/admin/finance");

  const canManage = hasPermission(access, PERMISSIONS.financeManage);
  const canRecord = hasPermission(access, PERMISSIONS.financeRecord);

  const db = createServiceClient();
  const [funds, entries, monthlyRates] = await Promise.all([
    loadFunds(db),
    loadEntries(db),
    loadSavingsMonthlyRates(db),
  ]);

  return (
    <SavingsManagement
      canManage={canManage}
      canRecord={canRecord}
      entries={entries}
      funds={funds}
      initialMonthlyRates={monthlyRates}
      today={todayInVietnam()}
    />
  );
}
