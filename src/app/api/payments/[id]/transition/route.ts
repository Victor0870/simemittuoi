import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PAYMENT_LIMITS } from "@/lib/payments/registry";
import { loadPaymentRequestRow, paymentAbilities } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";

type Params = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** { to: "approved" | "rejected" | "paid" | "cancelled", note?, categoryId? (bắt buộc khi duyệt – danh mục chi) } */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getCurrentAccess();
    if (!access?.isApproved) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    const can = paymentAbilities(access);
    if (!can.view) return NextResponse.json({ error: "Không tìm thấy đề nghị thanh toán." }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as { to?: string; note?: string; categoryId?: string };
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > PAYMENT_LIMITS.note) {
      return NextResponse.json({ error: `Ghi chú tối đa ${PAYMENT_LIMITS.note} ký tự.` }, { status: 400 });
    }

    const db = createServiceClient();
    const current = await loadPaymentRequestRow(db, id);
    if (!current) return NextResponse.json({ error: "Không tìm thấy đề nghị thanh toán." }, { status: 404 });

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

    let error;
    if (body.to === "approved") {
      const categoryId = typeof body.categoryId === "string" && UUID_RE.test(body.categoryId) ? body.categoryId : null;
      if (!categoryId) return NextResponse.json({ error: "Vui lòng chọn danh mục chi trước khi duyệt." }, { status: 400 });
      ({ error } = await db.rpc(CDILV_RPC.paymentRequestApprove, {
        p_request_id: id,
        p_actor_id: access.userId,
        p_category_id: categoryId,
        p_note: note || null,
      }));
    } else {
      ({ error } = await db.rpc(CDILV_RPC.paymentRequestTransition, {
        p_request_id: id,
        p_actor_id: access.userId,
        p_to_status: body.to,
        p_note: note || null,
      }));
    }
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/payments/transition] error:", err);
    return NextResponse.json({ error: "Không cập nhật được đề nghị thanh toán." }, { status: 500 });
  }
}
