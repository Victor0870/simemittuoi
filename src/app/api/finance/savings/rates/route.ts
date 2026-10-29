import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadSavingsMonthlyRates } from "@/lib/finance/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERIOD_RE = /^\d{4}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.financeView);
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;
    const fundId = searchParams.get("fundId") || undefined;

    if (month && !PERIOD_RE.test(month)) {
      return NextResponse.json({ error: "Tháng không hợp lệ (định dạng YYYY-MM)." }, { status: 400 });
    }
    if (fundId && !UUID_RE.test(fundId)) {
      return NextResponse.json({ error: "Mã sổ tiết kiệm không hợp lệ." }, { status: 400 });
    }

    const db = createServiceClient();
    const rates = await loadSavingsMonthlyRates(db, month, fundId);
    return NextResponse.json({ rates });
  } catch (err: unknown) {
    console.error("[api/finance/savings/rates] GET error:", err);
    return NextResponse.json({ error: "Không tải được bảng lãi suất tháng." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.financeRecord);
    if (guard.response) return guard.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const periodMonth = typeof body.periodMonth === "string" ? body.periodMonth.trim() : "";
    if (!PERIOD_RE.test(periodMonth)) {
      return NextResponse.json({ error: "Tháng tính lãi không hợp lệ (định dạng YYYY-MM)." }, { status: 400 });
    }

    const rawRates = Array.isArray(body.rates) ? body.rates : [];
    if (rawRates.length === 0) {
      return NextResponse.json({ error: "Không có dữ liệu lãi suất để lưu." }, { status: 400 });
    }

    const rowsToUpsert: Array<{
      fund_id: string;
      period_month: string;
      interest_rate: number;
      principal_amount: number;
      interest_amount: number;
      days_in_month: number | null;
      calculation_formula: string | null;
      note: string | null;
      created_by: string;
      updated_at: string;
    }> = [];

    const now = new Date().toISOString();

    for (const item of rawRates) {
      const fundId = typeof item.fundId === "string" && UUID_RE.test(item.fundId) ? item.fundId : null;
      if (!fundId) {
        return NextResponse.json({ error: "Mã sổ tiết kiệm không hợp lệ." }, { status: 400 });
      }

      const rateNum = Number(String(item.interestRate).replace(",", "."));
      if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) {
        return NextResponse.json({ error: "Lãi suất (%/năm) không hợp lệ (từ 0% đến 100%)." }, { status: 400 });
      }

      const principal = Math.round(Number(item.principalAmount ?? 0));
      if (!Number.isFinite(principal) || principal < 0) {
        return NextResponse.json({ error: "Số tiền gốc không hợp lệ." }, { status: 400 });
      }

      const interest = Math.round(Number(item.interestAmount ?? 0));
      if (!Number.isFinite(interest) || interest < 0) {
        return NextResponse.json({ error: "Tiền lãi không hợp lệ." }, { status: 400 });
      }

      const daysInMonth = item.daysInMonth ? Math.round(Number(item.daysInMonth)) : null;
      const formula = typeof item.formula === "string" ? item.formula.slice(0, 300) : null;
      const note = typeof item.note === "string" ? item.note.slice(0, 500) : null;

      rowsToUpsert.push({
        fund_id: fundId,
        period_month: periodMonth,
        interest_rate: Math.round(rateNum * 100) / 100,
        principal_amount: principal,
        interest_amount: interest,
        days_in_month: daysInMonth,
        calculation_formula: formula,
        note,
        created_by: guard.access.userId,
        updated_at: now,
      });
    }

    const db = createServiceClient();
    const { error } = await db.from(CDILV_TABLE.savingsMonthlyRates).upsert(rowsToUpsert, {
      onConflict: "fund_id,period_month",
    });

    if (error) {
      console.error("[api/finance/savings/rates] upsert error:", error);
      return NextResponse.json({ error: `Lỗi khi lưu bảng lãi suất: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: rowsToUpsert.length });
  } catch (err: unknown) {
    console.error("[api/finance/savings/rates] POST error:", err);
    return NextResponse.json({ error: "Không lưu được bảng lãi suất tháng." }, { status: 500 });
  }
}
