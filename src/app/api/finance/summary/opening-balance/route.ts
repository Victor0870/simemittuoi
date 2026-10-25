import { NextRequest, NextResponse } from "next/server";
import { FINANCE_LIMITS, isValidDate } from "@/lib/finance/registry";
import { requireFinanceWriteAccess } from "@/lib/finance/summary-excel";
import { savePeriodOpeningBalance } from "@/lib/finance/summary-server";
import { createServiceClient } from "@/lib/supabase/service";

const PERIOD_KEY_RE = /^(month:\d{4}-\d{2}|quarter:\d{4}-Q[1-4]|year:\d{4})$/;

/**
 * Lưu hoặc xóa số dư đầu kỳ kết chuyển cho một kỳ (Tháng / Quý / Năm).
 * Body: { periodKey: string, fromDate: string, amount: number | null, note?: string | null }
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireFinanceWriteAccess();
    if (access instanceof NextResponse) return access;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const periodKey = typeof body.periodKey === "string" ? body.periodKey.trim() : "";
    const fromDate = typeof body.fromDate === "string" ? body.fromDate.trim() : "";

    if (!PERIOD_KEY_RE.test(periodKey) || !isValidDate(fromDate)) {
      return NextResponse.json({ error: "Kỳ báo cáo không hợp lệ." }, { status: 400 });
    }

    let amount: number | null = null;
    if (body.amount !== null && body.amount !== undefined && body.amount !== "") {
      const parsed = Math.round(Number(body.amount));
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > FINANCE_LIMITS.maxAmount) {
        return NextResponse.json({ error: "Số dư đầu kỳ không hợp lệ (từ 0 đến 100 tỷ VNĐ)." }, { status: 400 });
      }
      amount = parsed;
    }

    const note = typeof body.note === "string" ? body.note.trim().slice(0, FINANCE_LIMITS.reason) : null;

    const db = createServiceClient();
    const openingBalances = await savePeriodOpeningBalance(db, {
      periodKey,
      fromDate,
      amount,
      note,
      actorId: access.userId,
    });

    return NextResponse.json({ success: true, openingBalances });
  } catch (err: unknown) {
    console.error("[api/finance/summary/opening-balance] error:", err);
    return NextResponse.json({ error: "Không lưu được số dư đầu kỳ." }, { status: 500 });
  }
}
