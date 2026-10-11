import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { sanitizeCompanyNames } from "@/lib/privacy";

export async function GET(request: NextRequest) {
  try {
    const publicDb = createPublicClient();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let isApproved = false;
    let isAdmin = false;
    let myPendingCount = 0;

    if (user) {
      const { data: me } = await publicDb
        .from(CDILV_TABLE.profiles)
        .select("role, approval_status")
        .eq("id", user.id)
        .maybeSingle();

      isApproved = me?.approval_status === "approved";
      isAdmin = isApproved && me?.role === "admin";

      if (isApproved) {
        // Đếm số ý kiến chưa được phản hồi của user này
        const { count, error: countErr } = await publicDb
          .from(CDILV_TABLE.feedbacks)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("admin_reply", null);

        if (!countErr) {
          myPendingCount = count ?? 0;
        }
      }
    }

    // Lấy danh sách tất cả góp ý
    const { data: rawFeedbacks, error } = await publicDb
      .from(CDILV_TABLE.feedbacks)
      .select(`
        id,
        user_id,
        content,
        status,
        admin_reply,
        admin_replied_at,
        admin_replied_by,
        admin_name,
        created_at,
        cdilv_profiles!user_id (
          id,
          full_name,
          avatar_url,
          role,
          department,
          employee_code
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const feedbacks = (rawFeedbacks ?? []).map((row: any) => {
      const prof = Array.isArray(row.cdilv_profiles)
        ? row.cdilv_profiles[0]
        : row.cdilv_profiles;

      return {
        id: row.id,
        userId: row.user_id,
        content: row.content,
        status: row.status || (row.admin_reply ? "replied" : "pending"),
        adminReply: row.admin_reply,
        adminRepliedAt: row.admin_replied_at,
        adminName: row.admin_name || "Chủ tịch Công đoàn",
        createdAt: row.created_at,
        author: {
          id: prof?.id ?? row.user_id,
          fullName: prof?.full_name || "Đoàn viên ẩn danh",
          avatarUrl: prof?.avatar_url || null,
          department: prof?.department || null,
          role: prof?.role || "member",
        },
      };
    });

    return NextResponse.json({
      feedbacks,
      myPendingCount,
      maxPending: 5,
      isLoggedIn: !!user,
      isApproved,
      isAdmin,
      currentUserId: user?.id ?? null,
    });
  } catch (err: any) {
    console.error("[api/feedbacks] GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tải danh sách góp ý." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const publicDb = createPublicClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để gửi ý kiến đóng góp." },
        { status: 401 },
      );
    }

    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (me?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "Tài khoản của bạn cần được phê duyệt để sử dụng hòm thư góp ý." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content || content.length < 5) {
      return NextResponse.json(
        { error: "Nội dung ý kiến đóng góp cần ít nhất 5 ký tự." },
        { status: 400 },
      );
    }

    // 1. Kiểm tra giới hạn 5 ý kiến chưa được admin phản hồi
    // (Không nói ra quy tắc, nhưng nếu >= 5 thì chặn và hiện popup)
    const { count: pendingCount, error: countErr } = await publicDb
      .from(CDILV_TABLE.feedbacks)
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("admin_reply", null);

    if (countErr) {
      throw countErr;
    }

    if ((pendingCount ?? 0) >= 5) {
      return NextResponse.json(
        {
          error: "over_limit",
          message:
            "Cảm ơn bạn đã đóng góp, hiện tại chủ tịch đang quá tải sẽ giải quyết góp ý sau",
        },
        { status: 429 },
      );
    }

    // 2. Chèn ý kiến mới vào database (tự động chuẩn hóa tên công ty đứng độc lập)
    const finalContent = sanitizeCompanyNames(content);

    const { data: inserted, error: insErr } = await publicDb
      .from(CDILV_TABLE.feedbacks)
      .insert({
        user_id: user.id,
        content: finalContent,
        status: "pending",
      })
      .select()
      .single();

    if (insErr) {
      throw insErr;
    }

    return NextResponse.json({
      success: true,
      feedback: inserted,
      message: "Gửi ý kiến đóng góp thành công!",
    });
  } catch (err: any) {
    console.error("[api/feedbacks] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể gửi ý kiến đóng góp." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const publicDb = createPublicClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID góp ý." }, { status: 400 });
    }

    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = me?.role === "admin" && me?.approval_status === "approved";

    // Kiểm tra quyền sở hữu nếu không phải admin
    const { data: fb } = await publicDb
      .from(CDILV_TABLE.feedbacks)
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (!fb) {
      return NextResponse.json({ error: "Không tìm thấy ý kiến." }, { status: 404 });
    }

    if (!isAdmin && fb.user_id !== user.id) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa ý kiến này." },
        { status: 403 },
      );
    }

    const { error: delErr } = await publicDb
      .from(CDILV_TABLE.feedbacks)
      .delete()
      .eq("id", id);

    if (delErr) {
      throw delErr;
    }

    return NextResponse.json({ success: true, message: "Đã xóa ý kiến." });
  } catch (err: any) {
    console.error("[api/feedbacks] DELETE error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể xóa ý kiến." },
      { status: 500 },
    );
  }
}
