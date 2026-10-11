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

    // Kiểm tra quyền Admin
    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (me?.role !== "admin" || me?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên mới có quyền chỉnh sửa bài viết." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { id, title, content, tag, tagTone, isImportant } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Thiếu ID bài viết." },
        { status: 400 },
      );
    }

    const trimmedTitle = (title || "").trim();
    if (!trimmedTitle) {
      return NextResponse.json(
        { error: "Tiêu đề bài viết không được để trống." },
        { status: 400 },
      );
    }

    const trimmedContent = (content || "").trim();
    if (!trimmedContent) {
      return NextResponse.json(
        { error: "Nội dung bài viết không được để trống." },
        { status: 400 },
      );
    }

    const updatePayload: Record<string, any> = {
      title: trimmedTitle,
      content: trimmedContent,
    };

    if (tag !== undefined && typeof tag === "string") {
      updatePayload.tag = tag.trim() || "Thông báo";
    }

    if (tagTone !== undefined && typeof tagTone === "string") {
      updatePayload.tag_tone = tagTone.trim() || "primary";
    }

    if (isImportant !== undefined) {
      updatePayload.is_important = Boolean(isImportant);
    }

    const { data: updatedPost, error: updateErr } = await publicDb
      .from(CDILV_TABLE.posts)
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      console.error("[api/posts/update] updateErr:", updateErr);
      throw updateErr;
    }

    // Làm mới cache các trang liên quan
    revalidatePath("/");
    revalidatePath("/posts");
    revalidatePath(`/posts/${id}`);

    return NextResponse.json({
      success: true,
      message: "Cập nhật bài viết thành công!",
      post: updatedPost,
    });
  } catch (err: any) {
    console.error("[api/posts/update] error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể cập nhật bài viết." },
      { status: 500 },
    );
  }
}
