import Link from "next/link";
import { redirect } from "next/navigation";
import { FinanceSummaryView } from "@/components/finance/FinanceSummaryView";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { financeAbilities } from "@/lib/finance/server";
import { parseSummaryFilter } from "@/lib/finance/summary";
import { loadFinanceSummaryDataset } from "@/lib/finance/summary-server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    periodType?: string;
    year?: string;
    month?: string;
    quarter?: string;
  }>;
};

const navButtonClass =
  "inline-flex items-center gap-1 rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]";

export default async function AdminFinanceSummaryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/finance/summary");

  const can = financeAbilities(access);
  if (!can.view && !can.record && !can.manage) redirect("/");

  const today = todayInVietnam();
  const initialFilter = parseSummaryFilter(params, today);
  const db = createServiceClient();
  const dataset = await loadFinanceSummaryDataset(db);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
            <Link className="hover:text-[#173A67] hover:underline" href="/admin/finance">
              Tài chính công đoàn
            </Link>
            <span>/</span>
            <span className="text-[#173A67]">Tổng hợp thu chi</span>
          </div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Tổng hợp thu chi</h1>
          <p className="text-sm text-on-surface-variant">
            Tổng hợp thu và tổng hợp chi theo danh mục (lọc theo tháng / quý / năm), quản lý số dư đầu kỳ kết chuyển từ sổ cũ, nhập và xuất Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className={navButtonClass} href="/admin/finance">
            <MaterialIcon className="text-[18px]" name="arrow_back" />
            Về Tài chính
          </Link>
          <Link className={navButtonClass} href="/office/finance">
            <MaterialIcon className="text-[18px]" name="account_balance_wallet" />
            Mở Sổ quỹ
          </Link>
        </div>
      </div>

      <FinanceSummaryView
        canWrite={can.record || can.manage}
        categories={dataset.categories}
        entries={dataset.entries}
        entryNotes={dataset.entryNotes}
        funds={dataset.funds}
        initialFilter={initialFilter}
        initialOpeningBalances={dataset.openingBalances}
        today={today}
      />
    </div>
  );
}
