import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập tài khoản." },
        { status: 401 },
      );
    }

    const publicDb = createServiceClient();

    // Check admin role
    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (me?.role !== "admin" || me?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên mới có quyền điều chỉnh trạng thái đăng ký." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { activityId, isOpen } = body;

    if (!activityId) {
      return NextResponse.json(
        { error: "Thiếu mã hoạt động." },
        { status: 400 },
      );
    }

    const targetOpen = Boolean(isOpen);

    const { error: updateErr } = await publicDb
      .from(CDILV_TABLE.activities)
      .update({ is_registration_open: targetOpen })
      .eq("id", activityId);

    if (updateErr) {
      throw updateErr;
    }

    revalidatePath("/");
    revalidatePath(`/activities/${activityId}`);

    return NextResponse.json({
      success: true,
      isOpen: targetOpen,
      message: targetOpen
        ? "Đã mở lại đăng ký tham gia cho hoạt động."
        : "Đã dừng nhận đăng ký tham gia hoạt động này.",
    });
  } catch (err: any) {
    console.error("[api/activities/toggle] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi cập nhật trạng thái." },
      { status: 500 },
    );
  }
}
