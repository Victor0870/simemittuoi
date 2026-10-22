import Link from "next/link";
import { redirect } from "next/navigation";
import { FundLedger } from "@/components/finance/FundLedger";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { financeAbilities, loadCategories, loadEntries, loadFunds, loadLockedThrough } from "@/lib/finance/server";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const buttonClass =
  "flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]";

export default async function OfficeFinancePage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/office/finance");
  const can = financeAbilities(access);
  if (!can.view) redirect("/");

  const db = createServiceClient();
  const [funds, categories, entries, lockedThrough, settings] = await Promise.all([
    loadFunds(db),
    loadCategories(db),
    loadEntries(db),
    loadLockedThrough(db),
    loadFormSettings(db),
  ]);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Sổ quỹ công đoàn</h1>
          <p className="text-sm text-on-surface-variant">
            Số dư từng quỹ, phiếu thu – chi, chuyển quỹ. Đề nghị thanh toán khi xác nhận &ldquo;Đã chi&rdquo; tự ghi phiếu chi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can.record ? (
            <>
              <Link
                className="flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-emerald-800"
                href="/office/finance/new?kind=income"
              >
                <MaterialIcon className="text-[18px]" name="south_west" />
                Ghi thu
              </Link>
              <Link
                className="flex items-center gap-1 rounded-xl bg-rose-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-rose-800"
                href="/office/finance/new?kind=expense"
              >
                <MaterialIcon className="text-[18px]" name="north_east" />
                Ghi chi
              </Link>
              <Link className={buttonClass} href="/office/finance/new?kind=transfer">
                <MaterialIcon className="text-[18px]" name="swap_horiz" />
                Chuyển quỹ
              </Link>
            </>
          ) : null}
          {can.manage ? (
            <Link className={buttonClass} href="/office/finance/settings">
              <MaterialIcon className="text-[18px]" name="settings" />
              Quỹ, danh mục & khóa sổ
            </Link>
          ) : null}
          <Link className={buttonClass} href={access.isAdmin ? "/admin" : "/office"}>
            <MaterialIcon className="text-[18px]" name="arrow_back" />
            {access.isAdmin ? "Trang Admin" : "Khu vực quản lý"}
          </Link>
        </div>
      </div>
      {funds.length === 0 ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Chưa khai báo quỹ nào. {can.manage ? "Vào “Quỹ, danh mục & khóa sổ” để thêm." : "Liên hệ người quản lý sổ quỹ."}
        </p>
      ) : (
        <FundLedger
          categories={categories}
          entries={entries}
          funds={funds}
          lockedThrough={lockedThrough}
          today={todayInVietnam()}
          unionName={settings.unionName}
        />
      )}
    </div>
  );
}
