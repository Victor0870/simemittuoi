import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { isScheduledAt, parseScheduledAt } from "@/lib/post-schedule";

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
        { error: "Chỉ Quản trị viên mới có quyền cập nhật hoạt động." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      id,
      title,
      description,
      location,
      eventDate,
      points,
      imageUrl,
      imageAlt,
      isRegistrationOpen,
      isActive,
      scheduledAt,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Thiếu mã hoạt động." },
        { status: 400 },
      );
    }

    const trimmedTitle = (title || "").trim();
    if (!trimmedTitle) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên hoạt động." },
        { status: 400 },
      );
    }

    const updatePayload: any = {
      title: trimmedTitle,
      description: (description || "").trim() || null,
      location: (location || "").trim() || null,
      event_date: eventDate || null,
      image_alt: imageAlt || trimmedTitle,
    };

    if (points !== undefined) {
      updatePayload.points = Math.max(0, parseInt(String(points), 10) || 0);
    }

    if (imageUrl !== undefined) {
      updatePayload.image_url = imageUrl || null;
    }

    if (isRegistrationOpen !== undefined) {
      updatePayload.is_registration_open = Boolean(isRegistrationOpen);
    }

    if (isActive !== undefined) {
      updatePayload.is_active = Boolean(isActive);
    }

    // scheduledAt: chuỗi ISO = hẹn giờ mới; null = bỏ hẹn giờ, hiển thị ngay nếu đang chờ giờ.
    if (typeof scheduledAt === "string") {
      const parsed = parseScheduledAt(scheduledAt);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      updatePayload.published_at = parsed.iso;
    } else if (scheduledAt === null) {
      const { data: current, error: currentErr } = await publicDb
        .from(CDILV_TABLE.activities)
        .select("published_at")
        .eq("id", id)
        .maybeSingle();
      if (currentErr) throw currentErr;
      if (current?.published_at && isScheduledAt(current.published_at)) {
        updatePayload.published_at = new Date().toISOString();
      }
    }

    const { data: updatedActivity, error: updateErr } = await publicDb
      .from(CDILV_TABLE.activities)
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    revalidatePath("/");
    revalidatePath(`/activities/${id}`);
    revalidatePath("/admin");
    revalidatePath("/admin/activities");
    revalidatePath("/missions");

    return NextResponse.json({
      success: true,
      message: "Cập nhật hoạt động thành công!",
      activity: updatedActivity,
    });
  } catch (err: any) {
    console.error("[api/activities/update] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi cập nhật hoạt động." },
      { status: 500 },
    );
  }
}
