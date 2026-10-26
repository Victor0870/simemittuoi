import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { isScheduledAt, parseScheduledAt } from "@/lib/post-schedule";
import { isAllowedPostImageUrl } from "@/lib/post-images";
import { GUIDE_POST_CATEGORY } from "@/lib/post-categories";

const MAX_CONTEST_PROMPT = 300;

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

    const access = await getCurrentAccess();
    if (!access || !hasPermission(access, PERMISSIONS.postsManage)) {
      return NextResponse.json(
        { error: "Bạn chưa được phân quyền chỉnh sửa bài viết." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      id,
      title,
      content,
      tag,
      tagTone,
      isImportant,
      isActive,
      isContest,
      contestPrompt,
      scheduledAt,
      imageUrl,
    } = body;

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

    if (isActive !== undefined) {
      updatePayload.is_active = Boolean(isActive);
    }

    if (isContest !== undefined) {
      const nextIsContest = Boolean(isContest);
      updatePayload.is_contest = nextIsContest;
      if (!nextIsContest) {
        updatePayload.contest_prompt = null;
      }
    }

    if (contestPrompt !== undefined && updatePayload.is_contest !== false) {
      updatePayload.contest_prompt =
        typeof contestPrompt === "string" && contestPrompt.trim()
          ? contestPrompt.trim().slice(0, MAX_CONTEST_PROMPT)
          : null;
    }

    // imageUrl: undefined = giữ nguyên ảnh đại diện; null/"" = xóa ảnh; chuỗi = ảnh mới (chỉ Storage CDILV).
    if (imageUrl === null || imageUrl === "") {
      updatePayload.image_url = null;
    } else if (imageUrl !== undefined) {
      if (!isAllowedPostImageUrl(imageUrl)) {
        return NextResponse.json({ error: "Ảnh đại diện không hợp lệ." }, { status: 400 });
      }
      updatePayload.image_url = imageUrl;
    }

    // scheduledAt: chuỗi ISO = hẹn giờ mới; null = bỏ hẹn giờ, đăng ngay nếu bài đang chờ giờ.
    if (typeof scheduledAt === "string") {
      const parsed = parseScheduledAt(scheduledAt);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      updatePayload.published_at = parsed.iso;
    } else if (scheduledAt === null) {
      const { data: current, error: currentErr } = await publicDb
        .from(CDILV_TABLE.posts)
        .select("published_at")
        .eq("id", id)
        .maybeSingle();
      if (currentErr) throw currentErr;
      if (current && isScheduledAt(current.published_at)) {
        updatePayload.published_at = new Date().toISOString();
      }
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
    revalidatePath(GUIDE_POST_CATEGORY.href);
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
