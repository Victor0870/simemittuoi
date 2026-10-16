import { NextRequest, NextResponse } from "next/server";
import { getAlbumMemberContext } from "@/lib/album-access";
import { emptyReactions, isReactionType, type ReactionType } from "@/lib/data/albums";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAlbumMemberContext();
    if (!ctx.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để thả biểu tượng cảm xúc." },
        { status: 401 },
      );
    }
    if (!ctx.isApproved) {
      return NextResponse.json(
        { error: "Tài khoản của bạn cần được phê duyệt để tương tác." },
        { status: 403 },
      );
    }

    const { photoId, reactionType } = await request.json();
    if (!photoId || !isReactionType(reactionType)) {
      return NextResponse.json({ error: "Dữ liệu cảm xúc không hợp lệ." }, { status: 400 });
    }

    const writer = createServiceClient();
    const userId = ctx.user.id;

    const { data: existing, error: fetchErr } = await writer
      .from(CDILV_TABLE.albumPhotoReactions)
      .select("id, reaction_type")
      .eq("photo_id", photoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    let userReaction: ReactionType | null = reactionType;

    if (existing) {
      if (existing.reaction_type === reactionType) {
        const { error } = await writer
          .from(CDILV_TABLE.albumPhotoReactions)
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        userReaction = null;
      } else {
        const { error } = await writer
          .from(CDILV_TABLE.albumPhotoReactions)
          .update({ reaction_type: reactionType })
          .eq("id", existing.id);
        if (error) throw error;
      }
    } else {
      const { error } = await writer
        .from(CDILV_TABLE.albumPhotoReactions)
        .insert({ photo_id: photoId, user_id: userId, reaction_type: reactionType });
      if (error) throw error;
    }

    const { data: all, error: allErr } = await writer
      .from(CDILV_TABLE.albumPhotoReactions)
      .select("reaction_type")
      .eq("photo_id", photoId);
    if (allErr) throw allErr;

    const reactions = emptyReactions();
    for (const r of all ?? []) {
      if (isReactionType(r.reaction_type)) reactions[r.reaction_type]++;
    }

    return NextResponse.json({ success: true, userReaction, reactions });
  } catch (err: any) {
    console.error("[api/albums/photos/reactions] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi khi xử lý cảm xúc." },
      { status: 500 },
    );
  }
}
