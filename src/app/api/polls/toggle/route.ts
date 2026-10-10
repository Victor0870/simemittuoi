import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const publicDb = createPublicClient();
    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (me?.role !== "admin" || me?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên mới có quyền." },
        { status: 403 },
      );
    }

    const { pollId, status, isActive } = await request.json();
    if (!pollId) {
      return NextResponse.json({ error: "Thiếu ID chương trình." }, { status: 400 });
    }

    const updatePayload: any = {};
    if (status) {
      updatePayload.status = status;
      if (status === "closed") {
        updatePayload.closed_at = new Date().toISOString();
      } else if (status === "open") {
        updatePayload.closed_at = null;
      }
    }

    if (typeof isActive === "boolean") {
      updatePayload.is_active = isActive;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    const { error } = await publicDb
      .from(CDILV_TABLE.polls)
      .update(updatePayload)
      .eq("id", pollId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      ...updatePayload,
      message: typeof isActive === "boolean"
        ? (isActive ? "Đã kích hoạt chương trình (Active)!" : "Đã chuyển chương trình sang Inactive (Tạm ẩn)!")
        : "Đã cập nhật trạng thái!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
