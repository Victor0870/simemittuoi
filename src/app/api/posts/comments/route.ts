import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { sanitizeCompanyNames } from "@/lib/privacy";

type MemberProfile = {
  role: string;
  full_name: string | null;
  approval_status: string;
};

/**
 * Hồ sơ đoàn viên đọc bằng phiên đăng nhập (role authenticated đã được GRANT SELECT).
 * service_role hiện không có quyền đọc cdilv_profiles — nếu dùng service client,
 * lỗi permission bị nuốt và hiện nhầm "Tài khoản không tồn tại".
 */
async function loadMemberProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data, error } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("role, full_name, approval_status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as MemberProfile | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "Thiếu postId." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Check if requester is an approved member or admin
    let isApproved = false;
    let isAdmin = false;
    let myCommentCount = 0;

    if (user) {
      const me = await loadMemberProfile(supabase, user.id);

      isApproved = me?.approval_status === "approved";
      isAdmin = isApproved && me?.role === "admin";
    }

    // Get total comment count for this post
    const { count: totalCommentsCount, error: countErr } = await supabase
      .from(CDILV_TABLE.postComments)
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);

    if (countErr) {
      throw countErr;
    }

    // Only approved members can view the actual comments
    if (!isApproved) {
      return NextResponse.json({
        totalCount: totalCommentsCount ?? 0,
        comments: [],
        isMember: false,
        isAdmin: false,
        canComment: false,
        myCommentCount: 0,
        maxComments: 3,
        message: "Chỉ thành viên Đoàn cơ sở mới có quyền xem nội dung bình luận.",
      });
    }

    // Query comments with author profile for members
    const { data: rawComments, error } = await supabase
      .from(CDILV_TABLE.postComments)
      .select(`
        id,
        post_id,
        user_id,
        content,
        created_at,
        parent_id,
        reply_to_user_id,
        cdilv_profiles!cdilv_post_comments_user_id_fkey (
          id,
          full_name,
          avatar_url,
          role,
          department,
          employee_code
        )
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    if (user) {
      myCommentCount = (rawComments ?? []).filter(
        (c: any) => c.user_id === user.id && !c.parent_id,
      ).length;
    }

    const canComment = isAdmin || myCommentCount < 3;

    // Load reactions for comments
    const commentIds = (rawComments ?? []).map((c: any) => c.id);
    const reactionsMap = new Map<
      string,
      { like: number; heart: number; haha: number; userReaction: string | null }
    >();

    if (commentIds.length > 0) {
      const { data: rawReactions } = await supabase
        .from(CDILV_TABLE.commentReactions)
        .select("comment_id, user_id, reaction_type")
        .in("comment_id", commentIds);

      for (const r of rawReactions ?? []) {
        if (!reactionsMap.has(r.comment_id)) {
          reactionsMap.set(r.comment_id, {
            like: 0,
            heart: 0,
            haha: 0,
            userReaction: null,
          });
        }
        const curr = reactionsMap.get(r.comment_id)!;
        if (r.reaction_type === "like") curr.like++;
        else if (r.reaction_type === "heart") curr.heart++;
        else if (r.reaction_type === "haha") curr.haha++;

        if (user && r.user_id === user.id) {
          curr.userReaction = r.reaction_type;
        }
      }
    }

    const comments = (rawComments ?? []).map((row: any) => {
      const prof = Array.isArray(row.cdilv_profiles)
        ? row.cdilv_profiles[0]
        : row.cdilv_profiles;
      const rInfo = reactionsMap.get(row.id) || {
        like: 0,
        heart: 0,
        haha: 0,
        userReaction: null,
      };

      return {
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        authorName: prof?.full_name || "Đoàn viên",
        authorAvatar: prof?.avatar_url || null,
        authorRole: prof?.role || "user",
        authorDepartment: prof?.department || null,
        authorCode: prof?.employee_code || null,
        content: row.content,
        createdAt: row.created_at,
        parentId: row.parent_id ?? null,
        replyToUserId: row.reply_to_user_id ?? null,
        reactions: {
          like: rInfo.like,
          heart: rInfo.heart,
          haha: rInfo.haha,
        },
        userReaction: rInfo.userReaction,
      };
    });

    return NextResponse.json({
      totalCount: totalCommentsCount ?? comments.length,
      comments,
      isMember: true,
      myCommentCount,
      canComment,
      maxComments: isAdmin ? null : 3,
      isAdmin,
    });
  } catch (err: any) {
    console.error("[api/posts/comments] GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tải danh sách bình luận." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập tài khoản để tham gia bình luận." },
        { status: 401 },
      );
    }

    const me = await loadMemberProfile(supabase, user.id);

    if (!me) {
      return NextResponse.json(
        { error: "Tài khoản không tồn tại trong hệ thống." },
        { status: 403 },
      );
    }

    if (me.approval_status !== "approved") {
      return NextResponse.json(
        {
          error:
            "Tài khoản của bạn đang chờ phê duyệt. Chỉ đoàn viên chính thức mới có quyền đăng bình luận.",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { postId, content, parentId } = body;

    if (!postId) {
      return NextResponse.json(
        { error: "Thiếu mã bài viết." },
        { status: 400 },
      );
    }

    const trimmedContent = (content || "").trim();
    if (!trimmedContent) {
      return NextResponse.json(
        { error: "Nội dung bình luận không được để trống." },
        { status: 400 },
      );
    }

    if (trimmedContent.length > 3500) {
      return NextResponse.json(
        { error: "Bình luận quá dài (tối đa 3500 ký tự)." },
        { status: 400 },
      );
    }

    const isAdmin = me.role === "admin";
    const writer = createServiceClient();

    let replyFields: { parent_id: string; reply_to_user_id: string } | null = null;
    if (parentId) {
      const { data: parent, error: parentErr } = await writer
        .from(CDILV_TABLE.postComments)
        .select("id, post_id, parent_id, user_id")
        .eq("id", parentId)
        .maybeSingle();
      if (parentErr) throw parentErr;
      if (!parent || parent.post_id !== postId) {
        return NextResponse.json(
          { error: "Bình luận được trả lời không tồn tại hoặc đã bị xóa." },
          { status: 404 },
        );
      }
      replyFields = { parent_id: parent.parent_id ?? parent.id, reply_to_user_id: parent.user_id };
    }

    // Enforce 3 comments limit for regular union members (phản hồi không tính)
    if (!isAdmin && !replyFields) {
      const { count, error: countErr } = await writer
        .from(CDILV_TABLE.postComments)
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .is("parent_id", null);

      if (countErr) {
        throw countErr;
      }

      if ((count ?? 0) >= 3) {
        return NextResponse.json(
          {
            error:
              "Bạn đã đăng tối đa 3 bình luận cho bài viết này. Xin cảm ơn sự đóng góp của bạn!",
          },
          { status: 400 },
        );
      }
    }

    // Auto sanitize company names: 'Idemitsu' or standalone 'ILV' -> '**Tên Công Ty**'
    const finalContent = sanitizeCompanyNames(trimmedContent);

    // Insert comment
    const { data: newComment, error: insertError } = await writer
      .from(CDILV_TABLE.postComments)
      .insert({
        post_id: postId,
        user_id: user.id,
        content: finalContent,
        ...replyFields,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    if (replyFields) {
      revalidatePath(`/posts/${postId}`);
      return NextResponse.json({ success: true, comment: newComment });
    }

    // Award +1 score point for union member via secure RPC
    try {
      const { error: rpcErr } = await writer.rpc("cdilv_award_comment_score", {
        p_comment_id: newComment.id,
      });
      if (rpcErr) {
        console.error("[api/posts/comments] score award RPC error:", rpcErr.message);
      }
    } catch (scoreErr) {
      console.error("[api/posts/comments] score award error:", scoreErr);
    }

    revalidatePath(`/posts/${postId}`);
    revalidatePath("/posts");
    revalidatePath("/");
    revalidatePath("/leaderboard");

    return NextResponse.json({
      success: true,
      message: "Gửi bình luận thành công! Bạn nhận được +1 điểm thi đua.",
      comment: newComment,
    });
  } catch (err: any) {
    console.error("[api/posts/comments] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi gửi bình luận." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("id");

    if (!commentId) {
      return NextResponse.json(
        { error: "Thiếu mã bình luận." },
        { status: 400 },
      );
    }

    const me = await loadMemberProfile(supabase, user.id);
    const isAdmin = me?.role === "admin" && me?.approval_status === "approved";
    const writer = createServiceClient();

    // Fetch existing comment
    const { data: comment, error: fetchErr } = await writer
      .from(CDILV_TABLE.postComments)
      .select("id, post_id, user_id")
      .eq("id", commentId)
      .maybeSingle();

    if (fetchErr || !comment) {
      return NextResponse.json(
        { error: "Bình luận không tồn tại hoặc đã bị xóa." },
        { status: 404 },
      );
    }

    // Only comment author or admin can delete
    if (!isAdmin && comment.user_id !== user.id) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa bình luận này." },
        { status: 403 },
      );
    }

    // Delete comment
    const { error: delErr } = await writer
      .from(CDILV_TABLE.postComments)
      .delete()
      .eq("id", commentId);

    if (delErr) {
      throw delErr;
    }

    // Revoke awarded score point via RPC
    try {
      const { error: rpcRevokeErr } = await writer.rpc("cdilv_revoke_comment_score", {
        p_comment_id: commentId,
      });
      if (rpcRevokeErr) {
        console.error("[api/posts/comments] score revoke RPC error:", rpcRevokeErr.message);
      }
    } catch (scoreDelErr) {
      console.error("[api/posts/comments] score revoke error:", scoreDelErr);
    }

    revalidatePath(`/posts/${comment.post_id}`);
    revalidatePath("/posts");
    revalidatePath("/");
    revalidatePath("/leaderboard");

    return NextResponse.json({
      success: true,
      message: "Đã xóa bình luận thành công.",
    });
  } catch (err: any) {
    console.error("[api/posts/comments] DELETE error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi xóa bình luận." },
      { status: 500 },
    );
  }
}
