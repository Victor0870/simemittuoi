import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { LIFE_EVENT_LIMITS } from "@/lib/life-events/registry";
import { canHandleLifeEvents, loadLifeEventRow } from "@/lib/life-events/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";

type Params = { params: Promise<{ id: string }> };

/** Ghi chú xử lý nội bộ (chỉ người có quyền tiếp nhận). */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getCurrentAccess();
    if (!access?.isApproved) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    if (!canHandleLifeEvents(access)) {
      return NextResponse.json({ error: "Bạn chưa được phân quyền ghi chú tin báo." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { note?: string };
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!note) return NextResponse.json({ error: "Vui lòng nhập ghi chú." }, { status: 400 });
    if (note.length > LIFE_EVENT_LIMITS.note) {
      return NextResponse.json({ error: `Ghi chú tối đa ${LIFE_EVENT_LIMITS.note} ký tự.` }, { status: 400 });
    }

    const db = createServiceClient();
    if (!(await loadLifeEventRow(db, id))) {
      return NextResponse.json({ error: "Không tìm thấy tin báo." }, { status: 404 });
    }
    const { error } = await db.rpc(CDILV_RPC.lifeEventLog, {
      p_event_id: id,
      p_actor_id: access.userId,
      p_action: "note",
      p_note: note,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/life-events/note] error:", err);
    return NextResponse.json({ error: "Không lưu được ghi chú." }, { status: 500 });
  }
}
