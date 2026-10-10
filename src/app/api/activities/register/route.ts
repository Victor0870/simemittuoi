import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
      return NextResponse.json(
        { error: "Vui lòng đăng nhập tài khoản để đăng ký tham gia hoạt động." },
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

    const publicDb = createPublicClient();

    // Check activity registration status
    const { data: act, error: actErr } = await publicDb
      .from(CDILV_TABLE.activities)
      .select("id, title, is_registration_open")
      .eq("id", activityId)
      .maybeSingle();

    if (actErr || !act) {
      return NextResponse.json(
        { error: "Hoạt động không tồn tại." },
        { status: 404 },
      );
    }

    if (act.is_registration_open === false) {
      return NextResponse.json(
        { error: "Hoạt động này hiện đã hết hạn đăng ký tham gia." },
        { status: 400 },
      );
    }

    // Insert registration
    const { error: insertErr } = await publicDb
      .from(CDILV_TABLE.activityRegistrations)
      .insert({
        activity_id: activityId,
        user_id: user.id,
      });

    if (insertErr && !insertErr.message.includes("duplicate key")) {
      throw insertErr;
    }

    revalidatePath("/");
    revalidatePath(`/activities/${activityId}`);
    revalidatePath("/missions");

    return NextResponse.json({
      success: true,
      message: `Đăng ký tham gia "${act.title}" thành công!`,
    });
  } catch (err: any) {
    console.error("[api/activities/register] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi đăng ký tham gia." },
      { status: 500 },
    );
  }
}
