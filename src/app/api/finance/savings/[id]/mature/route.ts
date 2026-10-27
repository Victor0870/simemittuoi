import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { parseSavingsMaturityInput, savingsMaturityRpcData } from "@/lib/finance/registry";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Xử lý sổ tiết kiệm đến hạn (quyền ghi sổ). Body: SavingsMaturityInput.
 * Tất toán: ghi lãi vào sổ, chuyển toàn bộ số dư về quỹ chi được, ngừng dùng sổ.
 * Tái tục: ghi lãi (nhập gốc hoặc về quỹ chi được), đặt ngày đáo hạn / lãi suất mới. Một giao dịch trong hàm cdilv_savings_mature.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(PERMISSIONS.financeRecord);
    if (guard.response) return guard.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Sổ tiết kiệm không hợp lệ." }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseSavingsMaturityInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(" ") }, { status: 400 });

    const db = createServiceClient();
    const { data, error } = await db.rpc(CDILV_RPC.savingsMature, {
      p_fund_id: id,
      p_actor_id: guard.access.userId,
      p_data: savingsMaturityRpcData(parsed.value),
    });
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    const result = (data ?? {}) as { codes?: string[] };
    return NextResponse.json({ success: true, codes: result.codes ?? [] });
  } catch (err: unknown) {
    console.error("[api/finance/savings/mature] error:", err);
    return NextResponse.json({ error: "Không xử lý được sổ tiết kiệm." }, { status: 500 });
  }
}
