import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadPaymentMember, loadPaymentMemberBank } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Tài khoản ngân hàng trong hồ sơ đoàn viên – điền vào thông tin chuyển khoản của đề nghị thanh toán. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requirePermission(PERMISSIONS.paymentsCreate);
    if (guard.response) return guard.response;

    const db = createServiceClient();
    const member = await loadPaymentMember(db, id);
    if (!member) return NextResponse.json({ error: "Không tìm thấy đoàn viên." }, { status: 404 });
    const bank = await loadPaymentMemberBank(db, guard.access.userId, member);
    return NextResponse.json({ member, bank });
  } catch (err: unknown) {
    console.error("[api/payments/members] error:", err);
    return NextResponse.json({ error: "Không tải được tài khoản ngân hàng của đoàn viên." }, { status: 500 });
  }
}
