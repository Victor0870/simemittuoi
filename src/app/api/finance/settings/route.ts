import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { FINANCE_LIMITS, isValidDate } from "@/lib/finance/registry";
import { FUND_SETTINGS_KEY } from "@/lib/finance/server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Cài đặt sổ quỹ. Body:
 *  { action: "saveFund", fund: { id?, kind, name, bankAccountNo, bankName, interestRate, maturityDate, openingBalance, openingDate, isActive, sortOrder } }
 *  { action: "setLock", lockedThrough: "YYYY-MM-DD" | null }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.financeManage);
    if (guard.response) return guard.response;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = createServiceClient();
    const now = new Date().toISOString();

    if (body.action === "saveFund") {
      const raw = (body.fund ?? {}) as Record<string, unknown>;
      const id = typeof raw.id === "string" && UUID_RE.test(raw.id) ? raw.id : null;
      const kind = raw.kind === "bank" || raw.kind === "savings" ? raw.kind : "cash";
      const isBank = kind !== "cash";
      const name = text(raw.name);
      const bankAccountNo = text(raw.bankAccountNo).replace(/\s/g, "") || null;
      const bankName = text(raw.bankName) || null;
      const rateText = text(raw.interestRate).replace(",", ".");
      const interestRate = kind === "savings" && rateText ? Math.round(Number(rateText) * 100) / 100 : null;
      const maturityDate = kind === "savings" ? text(raw.maturityDate) || null : null;
      const interestRateType = kind === "savings" ? (raw.interestRateType === "floating" ? "floating" : "fixed") : null;
      const termMonths = kind === "savings" && Number(raw.termMonths) > 0 ? Math.round(Number(raw.termMonths)) : null;
      const interestPeriod = kind === "savings" && typeof raw.interestPeriod === "string" ? text(raw.interestPeriod) : (kind === "savings" ? "monthly" : null);
      const depositDate = kind === "savings" && text(raw.depositDate) && isValidDate(text(raw.depositDate)) ? text(raw.depositDate) : null;
      const notes = kind === "savings" && text(raw.notes) ? text(raw.notes) : null;
      if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100)) {
        return bad("Lãi suất không hợp lệ.");
      }
      if (maturityDate !== null && !isValidDate(maturityDate)) return bad("Ngày đáo hạn không hợp lệ.");
      const openingBalance = Math.round(Number(raw.openingBalance ?? 0));
      const openingDate = text(raw.openingDate);
      const sortOrder = Math.round(Number(raw.sortOrder ?? 0)) || 0;
      if (!name || name.length > FINANCE_LIMITS.name) return bad("Tên quỹ không hợp lệ.");
      if ((bankAccountNo?.length ?? 0) > FINANCE_LIMITS.account || (bankName?.length ?? 0) > FINANCE_LIMITS.name) {
        return bad("Số tài khoản / tên ngân hàng quá dài.");
      }
      if (!Number.isFinite(openingBalance) || openingBalance < 0 || openingBalance > FINANCE_LIMITS.maxAmount) {
        return bad("Số dư đầu kỳ không hợp lệ.");
      }
      if (!isValidDate(openingDate)) return bad("Ngày bắt đầu theo dõi không hợp lệ.");

      const row = {
        name,
        bank_account_no: isBank ? bankAccountNo : null,
        bank_name: isBank ? bankName : null,
        interest_rate: interestRate,
        maturity_date: maturityDate,
        interest_rate_type: interestRateType,
        term_months: termMonths,
        interest_period: interestPeriod,
        deposit_date: depositDate,
        notes,
        opening_balance: openingBalance,
        opening_date: openingDate,
        is_active: raw.isActive !== false,
        sort_order: sortOrder,
        updated_by: guard.access.userId,
        updated_at: now,
      };
      const { error } = id
        ? await db.from(CDILV_TABLE.funds).update(row).eq("id", id)
        : await db.from(CDILV_TABLE.funds).insert({ ...row, kind });
      if (error) {
        if (error.code === "P0001") return bad(error.message, 409);
        throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === "setLock") {
      const lockedThrough = body.lockedThrough === null ? null : text(body.lockedThrough);
      if (lockedThrough !== null && !isValidDate(lockedThrough)) return bad("Ngày khóa sổ không hợp lệ.");
      if (lockedThrough !== null && lockedThrough > todayInVietnam()) return bad("Không khóa sổ cho ngày trong tương lai.");
      const { error } = await db.from(CDILV_TABLE.appSettings).upsert({
        key: FUND_SETTINGS_KEY,
        value: { lockedThrough },
        updated_by: guard.access.userId,
        updated_at: now,
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return bad("Thao tác không hợp lệ.");
  } catch (err: unknown) {
    console.error("[api/finance/settings] error:", err);
    return NextResponse.json({ error: "Không lưu được cài đặt sổ quỹ." }, { status: 500 });
  }
}
