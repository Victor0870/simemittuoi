import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { FINANCE_LIMITS } from "@/lib/finance/registry";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";

type Params = { params: Promise<{ id: string }> };

/** Hủy bút toán (giữ số phiếu, ghi lý do). Body: { reason } */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requirePermission(PERMISSIONS.financeRecord);
    if (guard.response) return guard.response;

    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) return NextResponse.json({ error: "Vui lòng ghi lý do hủy bút toán." }, { status: 400 });
    if (reason.length > FINANCE_LIMITS.reason) {
      return NextResponse.json({ error: `Lý do tối đa ${FINANCE_LIMITS.reason} ký tự.` }, { status: 400 });
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Không tìm thấy bút toán." }, { status: 404 });

    const { error } = await createServiceClient().rpc(CDILV_RPC.fundEntryVoid, {
      p_entry_id: id,
      p_actor_id: guard.access.userId,
      p_reason: reason,
    });
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
      if (error.code === "P0002") return NextResponse.json({ error: error.message }, { status: 404 });
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/finance/entries/void] error:", err);
    return NextResponse.json({ error: "Không hủy được bút toán." }, { status: 500 });
  }
}
