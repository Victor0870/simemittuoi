import { NextRequest, NextResponse } from "next/server";
import { computeFinanceSummary, parseSummaryFilter } from "@/lib/finance/summary";
import { buildFinanceSummaryExport, requireFinanceViewAccess } from "@/lib/finance/summary-excel";
import { loadFinanceSummaryDataset } from "@/lib/finance/summary-server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { XLSX_MIME } from "@/lib/print/xlsx-template";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Xuất Excel bảng Tổng hợp thu – chi và Chi tiết thu – chi đúng theo bộ lọc đang xem.
 * Query: ?periodType=month|quarter|year&year=2026&month=10&quarter=4&includeZero=1|0
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireFinanceViewAccess();
    if (access instanceof NextResponse) return access;

    const sp = request.nextUrl.searchParams;
    const today = todayInVietnam();
    const filter = parseSummaryFilter(
      {
        periodType: sp.get("periodType") ?? undefined,
        year: sp.get("year") ?? undefined,
        month: sp.get("month") ?? undefined,
        quarter: sp.get("quarter") ?? undefined,
      },
      today,
    );
    const includeZeroCategories = sp.get("includeZero") !== "0";

    const db = createServiceClient();
    const dataset = await loadFinanceSummaryDataset(db);
    const summary = computeFinanceSummary({
      filter,
      funds: dataset.funds,
      categories: dataset.categories,
      entries: dataset.entries,
      entryNotes: dataset.entryNotes,
      openingBalances: dataset.openingBalances,
      includeZeroCategories,
    });

    const buffer = await buildFinanceSummaryExport(summary, dataset.unionName);
    const safeKey = summary.periodKey.replace(/:/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="Tong_hop_thu_chi_${safeKey}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[api/finance/summary/export] error:", err);
    return NextResponse.json({ error: "Không xuất được file Excel tổng hợp thu chi." }, { status: 500 });
  }
}
