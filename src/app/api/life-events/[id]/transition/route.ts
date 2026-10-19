import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { LIFE_EVENT_LIMITS } from "@/lib/life-events/registry";
import { canHandleLifeEvents, loadLifeEventRow } from "@/lib/life-events/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";

type Params = { params: Promise<{ id: string }> };

/** { to: "acknowledged" | "withdrawn", note? } */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getCurrentAccess();
    if (!access?.isApproved) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { to?: string; note?: string };
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > LIFE_EVENT_LIMITS.note) {
      return NextResponse.json({ error: `Ghi chú tối đa ${LIFE_EVENT_LIMITS.note} ký tự.` }, { status: 400 });
    }

    const db = createServiceClient();
    const event = await loadLifeEventRow(db, id);
    const isOwner = event?.member_id === access.userId;
    if (!event || (!isOwner && !canHandleLifeEvents(access))) {
      return NextResponse.json({ error: "Không tìm thấy tin báo." }, { status: 404 });
    }

    if (body.to === "withdrawn" && !isOwner) {
      return NextResponse.json({ error: "Chỉ người báo tin mới rút lại được." }, { status: 403 });
    }
    if (body.to === "acknowledged" && !canHandleLifeEvents(access)) {
      return NextResponse.json({ error: "Bạn chưa được phân quyền tiếp nhận tin báo." }, { status: 403 });
    }
    if (body.to !== "withdrawn" && body.to !== "acknowledged") {
      return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
    }

    const { error } = await db.rpc(CDILV_RPC.lifeEventTransition, {
      p_event_id: id,
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
    console.error("[api/life-events/transition] error:", err);
    return NextResponse.json({ error: "Không cập nhật được tin báo." }, { status: 500 });
  }
}
