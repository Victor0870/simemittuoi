import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { loadPaymentForVisit } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";
import { VISIT_LIMITS } from "@/lib/visits/registry";
import { loadVisitRequestRow, visitAbilities } from "@/lib/visits/server";

type Params = { params: Promise<{ id: string }> };

/** { to: "approved" | "rejected" | "paid" | "cancelled", note? } */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getCurrentAccess();
    if (!access?.isApproved) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    const can = visitAbilities(access);
    if (!can.view) return NextResponse.json({ error: "Không tìm thấy phiếu đề nghị." }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as { to?: string; note?: string };
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > VISIT_LIMITS.note) {
      return NextResponse.json({ error: `Ghi chú tối đa ${VISIT_LIMITS.note} ký tự.` }, { status: 400 });
    }

    const db = createServiceClient();
    const current = await loadVisitRequestRow(db, id);
    if (!current) return NextResponse.json({ error: "Không tìm thấy phiếu đề nghị." }, { status: 404 });

    const allowed =
      body.to === "approved" || body.to === "rejected"
        ? can.approve
        : body.to === "paid"
          ? can.pay
          : body.to === "cancelled"
            ? can.approve || (can.create && current.created_by === access.userId && current.status === "proposed")
            : null;
    if (allowed === null) return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
    if (!allowed) return NextResponse.json({ error: "Bạn chưa được phân quyền thực hiện thao tác này." }, { status: 403 });
    if (body.to === "rejected" && !note) {
      return NextResponse.json({ error: "Vui lòng ghi lý do từ chối." }, { status: 400 });
    }
    const payment = await loadPaymentForVisit(db, id);
    if (payment) {
      return NextResponse.json(
        { error: `Phiếu đang nằm trong đề nghị thanh toán ${payment.code} – xử lý ở đề nghị đó (hoặc bỏ phiếu khỏi đề nghị trước).` },
        { status: 409 },
      );
    }

    const { error } = await db.rpc(CDILV_RPC.visitRequestTransition, {
      p_request_id: id,
      p_actor_id: access.userId,
      p_to_status: body.to,
      p_note: note || null,
    });
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/visits/transition] error:", err);
    return NextResponse.json({ error: "Không cập nhật được phiếu đề nghị." }, { status: 500 });
  }
}
