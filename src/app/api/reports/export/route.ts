import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { XLSX_MIME } from "@/lib/print/xlsx-template";
import { buildReportWorkbook } from "@/lib/reports/excel";
import { loadReportBundle, parseReportParams } from "@/lib/reports/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tải báo cáo tổng hợp (Excel nhiều trang). ?year=2026&period=month|quarter */
export async function GET(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.reportsView);
    if (guard.response) return guard.response;

    const { year, granularity } = parseReportParams(
      {
        year: request.nextUrl.searchParams.get("year") ?? undefined,
        period: request.nextUrl.searchParams.get("period") ?? undefined,
      },
      Number(todayInVietnam().slice(0, 4)),
    );
    const db = createServiceClient();
    const [report, settings] = await Promise.all([loadReportBundle(db, year, granularity), loadFormSettings(db)]);
    const buffer = await buildReportWorkbook(report, settings.unionName);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="Bao_cao_cong_doan_${year}_${granularity === "month" ? "thang" : "quy"}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[api/reports/export] error:", err);
    return NextResponse.json({ error: "Không tạo được báo cáo." }, { status: 500 });
  }
}
