import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { sanitizeCompanyNames } from "@/lib/privacy";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const publicDb = createServiceClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = me?.role === "admin" && me?.approval_status === "approved";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên / Chủ tịch Công đoàn mới có quyền phản hồi góp ý." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { feedbackId, reply, adminName } = body;

    if (!feedbackId) {
      return NextResponse.json({ error: "Thiếu ID góp ý." }, { status: 400 });
    }

    const replyContent = typeof reply === "string" ? reply.trim() : "";

    // Nếu reply rỗng, có thể là thu hồi phản hồi (chuyển lại pending)
    if (!replyContent) {
      const { error: resetErr } = await publicDb
        .from(CDILV_TABLE.feedbacks)
        .update({
          admin_reply: null,
          admin_replied_at: null,
          admin_replied_by: null,
          admin_name: null,
          status: "pending",
        })
        .eq("id", feedbackId);

      if (resetErr) throw resetErr;

      return NextResponse.json({
        success: true,
        message: "Đã thu hồi phản hồi.",
      });
    }

    const displayName = adminName?.trim() || me?.full_name || "Chủ tịch Công đoàn";
    const finalReplyContent = sanitizeCompanyNames(replyContent);

    // Cập nhật phản hồi -> Chuyển status = 'replied'
    // Điều này sẽ giảm số lượng pending của tác giả, cho phép họ gửi thêm góp ý!
    const { error: updateErr } = await publicDb
      .from(CDILV_TABLE.feedbacks)
      .update({
        admin_reply: finalReplyContent,
        admin_replied_at: new Date().toISOString(),
        admin_replied_by: user.id,
        admin_name: displayName,
        status: "replied",
      })
      .eq("id", feedbackId);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      message: "Đã gửi phản hồi thành công!",
    });
  } catch (err: any) {
    console.error("[api/feedbacks/reply] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể lưu phản hồi." },
      { status: 500 },
    );
  }
}
