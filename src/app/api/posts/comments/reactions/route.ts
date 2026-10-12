import { NextRequest, NextResponse } from "next/server";
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
        { error: "Vui lòng đăng nhập để thả biểu tượng cảm xúc." },
        { status: 401 },
      );
    }

    const publicDb = createPublicClient();
    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (me?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "Tài khoản của bạn cần được phê duyệt để tương tác." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { commentId, reactionType } = body;

    if (!commentId || !["like", "heart", "haha"].includes(reactionType)) {
      return NextResponse.json(
        { error: "Dữ liệu cảm xúc không hợp lệ." },
        { status: 400 },
      );
    }

    // Kiểm tra xem user đã thả cảm xúc cho bình luận này chưa
    const { data: existing } = await publicDb
      .from(CDILV_TABLE.commentReactions)
      .select("id, reaction_type")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle();

    let action: "added" | "updated" | "removed";
    let finalUserReaction: "like" | "heart" | "haha" | null = null;

    if (existing) {
      if (existing.reaction_type === reactionType) {
        // Bấm lại đúng biểu tượng đó -> Bỏ thả cảm xúc (Toggle off)
        await publicDb
          .from(CDILV_TABLE.commentReactions)
          .delete()
          .eq("id", existing.id);
        action = "removed";
        finalUserReaction = null;
      } else {
        // Đổi sang biểu tượng cảm xúc khác
        await publicDb
          .from(CDILV_TABLE.commentReactions)
          .update({ reaction_type: reactionType })
          .eq("id", existing.id);
        action = "updated";
        finalUserReaction = reactionType;
      }
    } else {
      // Thả cảm xúc mới
      await publicDb
        .from(CDILV_TABLE.commentReactions)
        .insert({
          comment_id: commentId,
          user_id: user.id,
          reaction_type: reactionType,
        });
      action = "added";
      finalUserReaction = reactionType;
    }

    // Lấy tổng số lượng cảm xúc mới nhất của bình luận
    const { data: allReactions } = await publicDb
      .from(CDILV_TABLE.commentReactions)
      .select("reaction_type")
      .eq("comment_id", commentId);

    const counts = {
      like: 0,
      heart: 0,
      haha: 0,
    };
    for (const r of allReactions ?? []) {
      if (r.reaction_type === "like") counts.like++;
      else if (r.reaction_type === "heart") counts.heart++;
      else if (r.reaction_type === "haha") counts.haha++;
    }

    return NextResponse.json({
      success: true,
      action,
      userReaction: finalUserReaction,
      reactions: counts,
    });
  } catch (err: any) {
    console.error("[api/posts/comments/reactions] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi khi xử lý cảm xúc." },
      { status: 500 },
    );
  }
}
