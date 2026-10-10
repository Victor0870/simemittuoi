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
        { error: "Vui lòng đăng nhập tài khoản." },
        { status: 401 },
      );
    }

    const publicDb = createPublicClient();

    // Check admin role
    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (me?.role !== "admin" || me?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên mới có quyền tạo hoạt động." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      location,
      eventDate,
      points = 100,
      imageUrl,
      imageAlt,
      isRegistrationOpen = true,
    } = body;

    const trimmedTitle = (title || "").trim();
    if (!trimmedTitle) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên hoạt động." },
        { status: 400 },
      );
    }

    const pointsNum = Math.max(0, parseInt(String(points), 10) || 0);

    const { data: newActivity, error: insertErr } = await publicDb
      .from(CDILV_TABLE.activities)
      .insert({
        title: trimmedTitle,
        description: (description || "").trim() || null,
        location: (location || "").trim() || null,
        event_date: eventDate || null,
        points: pointsNum,
        image_url: imageUrl || null,
        image_alt: imageAlt || trimmedTitle,
        is_registration_open: isRegistrationOpen !== false,
      })
      .select()
      .single();

    if (insertErr) {
      throw insertErr;
    }

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/activities");
    revalidatePath("/missions");

    return NextResponse.json({
      success: true,
      message: "Tạo hoạt động mới thành công!",
      activity: newActivity,
    });
  } catch (err: any) {
    console.error("[api/activities/create] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi tạo hoạt động." },
      { status: 500 },
    );
  }
}
