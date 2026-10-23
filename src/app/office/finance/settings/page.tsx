import Link from "next/link";
import { redirect } from "next/navigation";
import { FinanceSettings } from "@/components/finance/FinanceSettings";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadFunds, loadLockedThrough } from "@/lib/finance/server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function FinanceSettingsPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/office/finance/settings");
  if (!hasPermission(access, PERMISSIONS.financeManage)) redirect("/office/finance");

  const db = createServiceClient();
  const [funds, lockedThrough] = await Promise.all([loadFunds(db), loadLockedThrough(db)]);

  return (
    <div className="max-w-3xl space-y-4 pb-10">
      <Link
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
        href="/office/finance"
      >
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        Sổ quỹ
      </Link>
      <div>
        <h1 className="text-headline-md font-extrabold text-[#173A67]">Quỹ & khóa sổ</h1>
        <p className="text-sm text-on-surface-variant">
          Khai báo số dư đầu kỳ, thêm tài khoản ngân hàng / sổ tiết kiệm và khóa sổ sau khi đối chiếu.
        </p>
      </div>
      <FinanceSettings
        canManageCatalogs={hasPermission(access, PERMISSIONS.catalogsManage)}
        funds={funds}
        lockedThrough={lockedThrough}
        today={todayInVietnam()}
      />
    </div>
  );
}
