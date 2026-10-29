import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { FINANCE_LIMITS, entryRpcData, isValidDate } from "@/lib/finance/registry";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.financeManage);
    if (guard.response) return guard.response;

    const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof raw.id === "string" && UUID_RE.test(raw.id) ? raw.id : null;
    const name = text(raw.name);
    const bankAccountNo = text(raw.bankAccountNo).replace(/\s/g, "") || null;
    const bankName = text(raw.bankName) || null;
    const interestRateType = raw.interestRateType === "floating" ? "floating" : "fixed";

    const rateText = text(raw.interestRate).replace(",", ".");
    const interestRate = rateText ? Math.round(Number(rateText) * 100) / 100 : null;

    const maturityDate = text(raw.maturityDate) || null;
    const termMonths = Number(raw.termMonths) > 0 ? Math.round(Number(raw.termMonths)) : null;
    const interestPeriod = typeof raw.interestPeriod === "string" ? text(raw.interestPeriod) : "monthly";
    const depositDate = text(raw.depositDate) && isValidDate(text(raw.depositDate)) ? text(raw.depositDate) : null;
    const notes = text(raw.notes) || null;

    const openingBalance = Math.round(Number(raw.openingBalance ?? 0));
    const openingDate = text(raw.openingDate) || depositDate || new Date().toISOString().slice(0, 10);
    const isActive = raw.isActive !== false;
    const sourceFundId = typeof raw.sourceFundId === "string" && UUID_RE.test(raw.sourceFundId) ? raw.sourceFundId : null;

    if (!name || name.length > FINANCE_LIMITS.name) {
      return NextResponse.json({ error: "Tên sổ tiết kiệm không được để trống và tối đa 120 ký tự." }, { status: 400 });
    }
    if ((bankAccountNo?.length ?? 0) > FINANCE_LIMITS.account) {
      return NextResponse.json({ error: "Số sổ tiết kiệm quá dài." }, { status: 400 });
    }
    if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100)) {
      return NextResponse.json({ error: "Lãi suất (%/năm) không hợp lệ (0% - 100%)." }, { status: 400 });
    }
    if (maturityDate !== null && !isValidDate(maturityDate)) {
      return NextResponse.json({ error: "Ngày đáo hạn không hợp lệ." }, { status: 400 });
    }
    if (!isValidDate(openingDate)) {
      return NextResponse.json({ error: "Ngày bắt đầu theo dõi / ngày gửi không hợp lệ." }, { status: 400 });
    }
    if (!Number.isFinite(openingBalance) || openingBalance < 0 || openingBalance > FINANCE_LIMITS.maxAmount) {
      return NextResponse.json({ error: "Số tiền gửi không hợp lệ." }, { status: 400 });
    }

    const db = createServiceClient();
    const now = new Date().toISOString();

    const row = {
      kind: "savings",
      name,
      bank_account_no: bankAccountNo,
      bank_name: bankName,
      interest_rate: interestRate,
      interest_rate_type: interestRateType,
      term_months: termMonths,
      interest_period: interestPeriod,
      deposit_date: depositDate,
      notes,
      maturity_date: maturityDate,
      opening_balance: openingBalance,
      opening_date: openingDate,
      is_active: isActive,
      updated_by: guard.access.userId,
      updated_at: now,
    };

    let savedFundId = id;

    if (id) {
      const { error } = await db.from(CDILV_TABLE.funds).update(row).eq("id", id);
      if (error) {
        if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
        throw error;
      }
    } else {
      // Find max sort_order
      const { data: maxOrderData } = await db
        .from(CDILV_TABLE.funds)
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (Number(maxOrderData?.sort_order) || 0) + 1;
      const { data: insertData, error } = await db
        .from(CDILV_TABLE.funds)
        .insert({ ...row, sort_order: nextOrder })
        .select("id")
        .single();

      if (error) {
        if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
        throw error;
      }
      savedFundId = insertData.id;

      // Nếu có chọn nguồn tiền gửi (trích từ quỹ thanh toán) và số tiền > 0, tạo phiếu chuyển quỹ tự động
      if (sourceFundId && openingBalance > 0 && savedFundId) {
        const transferDesc = `Gửi tiết kiệm vào sổ ${name}${bankAccountNo ? ` (${bankAccountNo})` : ""}`;
        await db.rpc(CDILV_RPC.fundEntrySave, {
          p_entry_id: null,
          p_actor_id: guard.access.userId,
          p_data: entryRpcData({
            entryDate: openingDate,
            kind: "transfer",
            fundId: sourceFundId,
            toFundId: savedFundId,
            categoryId: null,
            amount: openingBalance,
            description: transferDesc,
            counterparty: bankName || "Ngân hàng",
            documentNo: bankAccountNo,
          }),
          p_note: "Tự động trích tiền khi tạo sổ tiết kiệm mới",
        });
      }
    }

    return NextResponse.json({ success: true, id: savedFundId });
  } catch (err: unknown) {
    console.error("[api/finance/savings/book] error:", err);
    return NextResponse.json({ error: "Không lưu được thông tin sổ tiết kiệm." }, { status: 500 });
  }
}
