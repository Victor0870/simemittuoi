import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAlbumMemberContext } from "@/lib/album-access";
import { ALBUM_COMMENT_LIMIT, isReactionType, mapPhotoComment } from "@/lib/data/albums";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";
import { sanitizeCompanyNames } from "@/lib/privacy";

export async function GET(request: NextRequest) {
  try {
    const photoId = new URL(request.url).searchParams.get("photoId");
    if (!photoId) {
      return NextResponse.json({ error: "Thiếu mã ảnh." }, { status: 400 });
    }

    const ctx = await getAlbumMemberContext();
    if (!ctx.user || !ctx.isApproved) {
      return NextResponse.json(
        { error: "Chỉ thành viên mới được xem bình luận ảnh." },
        { status: 403 },
      );
    }

    const { data, error } = await ctx.supabase
      .from(CDILV_TABLE.albumPhotoComments)
      .select(
        "id, photo_id, user_id, content, created_at, parent_id, reply_to_user_id, cdilv_profiles!cdilv_album_photo_comments_user_id_fkey ( full_name, avatar_url, role, department, employee_code )",
      )
      .eq("photo_id", photoId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const comments = (data ?? []).map(mapPhotoComment);
    if (comments.length > 0) {
      const { data: reactionRows, error: reactionErr } = await ctx.supabase
        .from(CDILV_TABLE.albumPhotoCommentReactions)
        .select("comment_id, user_id, reaction_type")
        .in(
          "comment_id",
          comments.map((c) => c.id),
        );
      if (reactionErr) throw reactionErr;
      const byId = new Map(comments.map((c) => [c.id, c]));
      for (const r of reactionRows ?? []) {
        const comment = byId.get(r.comment_id);
        if (!comment || !isReactionType(r.reaction_type)) continue;
        comment.reactions[r.reaction_type]++;
        if (r.user_id === ctx.user.id) comment.userReaction = r.reaction_type;
      }
    }
    const myCommentCount = comments.filter((c) => c.userId === ctx.user!.id && !c.parentId).length;

    return NextResponse.json({
      comments,
      myCommentCount,
      maxComments: ctx.canManage ? null : ALBUM_COMMENT_LIMIT,
      canManage: ctx.canManage,
    });
  } catch (err: any) {
    console.error("[api/albums/photos/comments] GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tải bình luận." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAlbumMemberContext();
    if (!ctx.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập tài khoản để tham gia bình luận." },
        { status: 401 },
      );
    }
    if (!ctx.isApproved) {
      return NextResponse.json(
        { error: "Chỉ đoàn viên chính thức mới có quyền bình luận ảnh." },
        { status: 403 },
      );
    }

    const { photoId, content, parentId } = await request.json();
    if (!photoId) {
      return NextResponse.json({ error: "Thiếu mã ảnh." }, { status: 400 });
    }

    const trimmed = (typeof content === "string" ? content : "").trim();
    if (!trimmed) {
      return NextResponse.json(
        { error: "Nội dung bình luận không được để trống." },
        { status: 400 },
      );
    }
    if (trimmed.length > 1500) {
      return NextResponse.json(
        { error: "Bình luận quá dài (tối đa 1500 ký tự)." },
        { status: 400 },
      );
    }

    const writer = createServiceClient();
    const userId = ctx.user.id;

    const { data: photo, error: photoErr } = await writer
      .from(CDILV_TABLE.albumPhotos)
      .select("id")
      .eq("id", photoId)
      .maybeSingle();
    if (photoErr) throw photoErr;
    if (!photo) {
      return NextResponse.json({ error: "Ảnh không tồn tại hoặc đã bị xóa." }, { status: 404 });
    }

    let replyFields: { parent_id: string; reply_to_user_id: string } | null = null;
    if (parentId) {
      const { data: parent, error: parentErr } = await writer
        .from(CDILV_TABLE.albumPhotoComments)
        .select("id, photo_id, parent_id, user_id")
        .eq("id", parentId)
        .maybeSingle();
      if (parentErr) throw parentErr;
      if (!parent || parent.photo_id !== photoId) {
        return NextResponse.json(
          { error: "Bình luận được trả lời không tồn tại hoặc đã bị xóa." },
          { status: 404 },
        );
      }
      replyFields = { parent_id: parent.parent_id ?? parent.id, reply_to_user_id: parent.user_id };
    }

    if (!ctx.canManage && !replyFields) {
      const { count, error: countErr } = await writer
        .from(CDILV_TABLE.albumPhotoComments)
        .select("id", { count: "exact", head: true })
        .eq("photo_id", photoId)
        .eq("user_id", userId)
        .is("parent_id", null);
      if (countErr) throw countErr;

      if ((count ?? 0) >= ALBUM_COMMENT_LIMIT) {
        return NextResponse.json(
          {
            error: `Bạn đã đăng tối đa ${ALBUM_COMMENT_LIMIT} bình luận cho ảnh này. Xin cảm ơn sự đóng góp của bạn!`,
            limitReached: true,
          },
          { status: 400 },
        );
      }
    }

    const { data: inserted, error: insertErr } = await writer
      .from(CDILV_TABLE.albumPhotoComments)
      .insert({ photo_id: photoId, user_id: userId, content: sanitizeCompanyNames(trimmed), ...replyFields })
      .select("id, photo_id, user_id, content, created_at, parent_id, reply_to_user_id")
      .single();
    if (insertErr) throw insertErr;

    if (replyFields) {
      return NextResponse.json({ success: true, pointsAwarded: 0, comment: inserted });
    }

    let pointsAwarded = 0;
    const { data: awarded, error: rpcErr } = await writer.rpc(CDILV_RPC.awardAlbumCommentScore, {
      p_comment_id: inserted.id,
    });
    if (rpcErr) {
      console.error("[api/albums/photos/comments] score award RPC error:", rpcErr.message);
    } else {
      pointsAwarded = Number(awarded) || 0;
    }

    if (pointsAwarded > 0) {
      revalidatePath("/leaderboard");
      revalidatePath("/");
    }

    return NextResponse.json({
      success: true,
      pointsAwarded,
      comment: inserted,
      message:
        pointsAwarded > 0
          ? "Gửi bình luận thành công! Bạn nhận được +1 điểm thi đua."
          : "Gửi bình luận thành công!",
    });
  } catch (err: any) {
    console.error("[api/albums/photos/comments] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi gửi bình luận." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAlbumMemberContext();
    if (!ctx.user || !ctx.isApproved) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Thiếu mã bình luận." }, { status: 400 });
    }

    const writer = createServiceClient();
    const { data: comment, error: fetchErr } = await writer
      .from(CDILV_TABLE.albumPhotoComments)
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!comment) {
      return NextResponse.json(
        { error: "Bình luận không tồn tại hoặc đã bị xóa." },
        { status: 404 },
      );
    }
    if (!ctx.canManage && comment.user_id !== ctx.user.id) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa bình luận này." },
        { status: 403 },
      );
    }

    const { error: delErr } = await writer
      .from(CDILV_TABLE.albumPhotoComments)
      .delete()
      .eq("id", id);
    if (delErr) throw delErr;

    revalidatePath("/leaderboard");
    revalidatePath("/");

    return NextResponse.json({ success: true, message: "Đã xóa bình luận thành công." });
  } catch (err: any) {
    console.error("[api/albums/photos/comments] DELETE error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi xóa bình luận." },
      { status: 500 },
    );
  }
}
