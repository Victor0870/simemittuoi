import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";

/** Ghi nhận người đang đăng nhập đã xem popup (khách chỉ lưu trên trình duyệt). */
export async function POST(request: NextRequest) {
  const access = await getCurrentAccess();
  if (!access?.isApproved) return NextResponse.json({ ok: true });

  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Popup không hợp lệ." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: popup } = await db.from(CDILV_TABLE.popups).select("id").eq("id", id).maybeSingle();
  if (!popup) return NextResponse.json({ error: "Không tìm thấy popup." }, { status: 404 });

  const { error } = await db.rpc(CDILV_RPC.markPopupSeen, { p_popup_id: id, p_user_id: access.userId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
