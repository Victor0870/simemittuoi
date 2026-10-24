import Link from "next/link";
import { redirect } from "next/navigation";
import { ReportView } from "@/components/reports/ReportView";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { todayInVietnam } from "@/lib/life-events/registry";
import { loadReportBundle, parseReportParams } from "@/lib/reports/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ year?: string; period?: string }> };

export default async function OfficeReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/office/reports");
  if (!hasPermission(access, PERMISSIONS.reportsView)) redirect("/");

  const { year, granularity } = parseReportParams(params, Number(todayInVietnam().slice(0, 4)));
  const report = await loadReportBundle(createServiceClient(), year, granularity);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Báo cáo tổng hợp</h1>
          <p className="text-sm text-on-surface-variant">
            Thu – chi theo danh mục, tình hình các quỹ, thăm hỏi đoàn viên và đề nghị thanh toán năm {year}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission(access, PERMISSIONS.financeView) ? (
            <Link
              className="flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
              href="/office/finance"
            >
              <MaterialIcon className="text-[18px]" name="account_balance_wallet" />
              Sổ quỹ
            </Link>
          ) : null}
        </div>
      </div>
      <ReportView report={report} />
    </div>
  );
}
