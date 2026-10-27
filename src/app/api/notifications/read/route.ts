import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    const body = await request.json();
    const { id, all } = body;

    if (all) {
      // Đánh dấu tất cả thông báo của user là đã đọc
      const { error } = await supabase
        .from(CDILV_TABLE.notifications)
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;
    } else if (id) {
      // Đánh dấu 1 thông báo cụ thể
      const { error } = await supabase
        .from(CDILV_TABLE.notifications)
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/notifications/read] error:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi cập nhật thông báo." },
      { status: 500 },
    );
  }
}
