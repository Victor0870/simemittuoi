import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { entryRpcData, isValidDate } from "@/lib/finance/registry";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.financeRecord);
    if (guard.response) return guard.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const rateId = typeof body.rateId === "string" && UUID_RE.test(body.rateId) ? body.rateId : null;
    const targetFundId = typeof body.targetFundId === "string" && UUID_RE.test(body.targetFundId) ? body.targetFundId : null;
    const entryDate = typeof body.entryDate === "string" ? body.entryDate.trim() : "";
    const documentNo = typeof body.documentNo === "string" ? body.documentNo.trim().slice(0, 60) : null;
    const customDescription = typeof body.description === "string" ? body.description.trim() : null;

    if (!rateId) {
      return NextResponse.json({ error: "Bản ghi tiền lãi không hợp lệ." }, { status: 400 });
    }
    if (!targetFundId) {
      return NextResponse.json({ error: "Vui lòng chọn quỹ nhận tiền lãi." }, { status: 400 });
    }
    if (!isValidDate(entryDate)) {
      return NextResponse.json({ error: "Ngày ghi sổ không hợp lệ." }, { status: 400 });
    }

    const db = createServiceClient();

    // 1. Load rate record & fund info
    const { data: rate, error: rateErr } = await db
      .from(CDILV_TABLE.savingsMonthlyRates)
      .select("*, fund:cdilv_funds(id, name, bank_account_no, bank_name)")
      .eq("id", rateId)
      .maybeSingle();

    if (rateErr || !rate) {
      return NextResponse.json({ error: "Không tìm thấy bản ghi tính lãi." }, { status: 404 });
    }

    if (rate.is_collected) {
      return NextResponse.json({ error: "Tiền lãi tháng này của sổ đã được ghi thu trước đó." }, { status: 409 });
    }

    const interestAmount = Number(rate.interest_amount);
    if (interestAmount <= 0) {
      return NextResponse.json({ error: "Tiền lãi phải lớn hơn 0 đồng để ghi thu." }, { status: 400 });
    }

    // 2. Find savings_interest category
    const { data: catData } = await db
      .from(CDILV_TABLE.fundCategories)
      .select("id")
      .eq("kind", "income")
      .eq("system_key", "savings_interest")
      .eq("is_active", true)
      .maybeSingle();

    let categoryId = catData?.id;
    if (!categoryId) {
      const { data: fallbackCat } = await db
        .from(CDILV_TABLE.fundCategories)
        .select("id")
        .eq("kind", "income")
        .eq("is_active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      categoryId = fallbackCat?.id;
    }

    if (!categoryId) {
      return NextResponse.json({ error: "Chưa cấu hình danh mục thu cho lãi tiền gửi." }, { status: 400 });
    }

    // 3. Build description
    const fundObj = rate.fund as { name?: string; bank_account_no?: string; bank_name?: string } | null;
    const [y, m] = rate.period_month.split("-");
    const bookLabel = [fundObj?.name, fundObj?.bank_account_no ? `số ${fundObj.bank_account_no}` : null, fundObj?.bank_name]
      .filter(Boolean)
      .join(" - ");

    const defaultDesc = `Thu lãi tháng ${m}/${y} (${rate.interest_rate}%/năm) sổ tiết kiệm ${bookLabel || ""}`.trim();
    const description = customDescription || defaultDesc;

    // 4. Call cdilv_fund_entry_save RPC
    const rpcInput = {
      entryDate,
      kind: "income" as const,
      fundId: targetFundId,
      toFundId: null,
      categoryId,
      amount: interestAmount,
      description: description.slice(0, 300),
      counterparty: fundObj?.bank_name || "Ngân hàng",
      documentNo,
    };

    const { data: entryResult, error: entryErr } = await db
      .rpc(CDILV_RPC.fundEntrySave, {
        p_entry_id: null,
        p_actor_id: guard.access.userId,
        p_data: entryRpcData(rpcInput),
        p_note: `Tự động tạo từ Bảng tính lãi sổ tiết kiệm kỳ ${rate.period_month}`,
      })
      .single<{ id: string; code: string }>();

    if (entryErr) {
      if (entryErr.code === "P0001") return NextResponse.json({ error: entryErr.message }, { status: 409 });
      throw entryErr;
    }

    // 5. Update savings_monthly_rates
    const now = new Date().toISOString();
    await db
      .from(CDILV_TABLE.savingsMonthlyRates)
      .update({
        is_collected: true,
        collected_entry_id: entryResult.id,
        collected_at: now,
        updated_at: now,
      })
      .eq("id", rateId);

    return NextResponse.json({
      success: true,
      entryId: entryResult.id,
      entryCode: entryResult.code,
      message: `Đã ghi phiếu thu ${entryResult.code} số tiền ${new Intl.NumberFormat("vi-VN").format(interestAmount)} đ.`,
    });
  } catch (err: unknown) {
    console.error("[api/finance/savings/rates/collect] error:", err);
    return NextResponse.json({ error: "Không ghi thu được tiền lãi." }, { status: 500 });
  }
}
