import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function DELETE(request: NextRequest) {
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
        { error: "Chỉ Quản trị viên mới có quyền xóa hoạt động." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get("id");

    if (!activityId) {
      return NextResponse.json(
        { error: "Thiếu mã hoạt động." },
        { status: 400 },
      );
    }

    const { error: delErr } = await publicDb
      .from(CDILV_TABLE.activities)
      .delete()
      .eq("id", activityId);

    if (delErr) {
      throw delErr;
    }

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/activities");
    revalidatePath("/missions");

    return NextResponse.json({
      success: true,
      message: "Đã xóa hoạt động thành công.",
    });
  } catch (err: any) {
    console.error("[api/activities/delete] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi xóa hoạt động." },
      { status: 500 },
    );
  }
}
