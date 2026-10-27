import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

    const body = await request.json();
    const { activityId } = body;

    if (!activityId) {
      return NextResponse.json(
        { error: "Thiếu mã hoạt động." },
        { status: 400 },
      );
    }

    const { data: profile } = await supabase
      .from(CDILV_TABLE.profiles)
      .select("approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "Chỉ đoàn viên đã được phê duyệt mới được hủy đăng ký hoạt động." },
        { status: 403 },
      );
    }

    const { error: delErr } = await supabase
      .from(CDILV_TABLE.activityRegistrations)
      .delete()
      .eq("activity_id", activityId)
      .eq("user_id", user.id);

    if (delErr) {
      throw delErr;
    }

    revalidatePath("/");
    revalidatePath(`/activities/${activityId}`);
    revalidatePath("/missions");

    return NextResponse.json({
      success: true,
      message: "Đã hủy đăng ký tham gia hoạt động.",
    });
  } catch (err: any) {
    console.error("[api/activities/cancel] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi hủy đăng ký." },
      { status: 500 },
    );
  }
}
