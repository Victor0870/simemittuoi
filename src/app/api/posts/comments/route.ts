import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";

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

    const publicDb = createPublicClient();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Check if requester is an approved member or admin
    let isApproved = false;
    let isAdmin = false;
    let myCommentCount = 0;

    if (user) {
      const { data: me } = await publicDb
        .from(CDILV_TABLE.profiles)
        .select("role, approval_status")
        .eq("id", user.id)
        .maybeSingle();

      isApproved = me?.approval_status === "approved";
      isAdmin = isApproved && me?.role === "admin";
    }

    // Get total comment count for this post
    const { count: totalCommentsCount, error: countErr } = await publicDb
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
    const { data: rawComments, error } = await publicDb
      .from(CDILV_TABLE.postComments)
      .select(`
        id,
        post_id,
        user_id,
        content,
        created_at,
        cdilv_profiles (
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
        (c: any) => c.user_id === user.id,
      ).length;
    }

    const canComment = isAdmin || myCommentCount < 3;

    const comments = (rawComments ?? []).map((row: any) => {
      const prof = Array.isArray(row.cdilv_profiles)
        ? row.cdilv_profiles[0]
        : row.cdilv_profiles;
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

    const publicDb = createPublicClient();
    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role, full_name, approval_status")
      .eq("id", user.id)
      .maybeSingle();

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
    const { postId, content } = body;

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

    if (trimmedContent.length > 1000) {
      return NextResponse.json(
        { error: "Bình luận quá dài (tối đa 1000 ký tự)." },
        { status: 400 },
      );
    }

    const isAdmin = me.role === "admin";

    // Enforce 3 comments limit for regular union members
    if (!isAdmin) {
      const { count, error: countErr } = await publicDb
        .from(CDILV_TABLE.postComments)
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId)
        .eq("user_id", user.id);

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

    // Insert comment
    const { data: newComment, error: insertError } = await publicDb
      .from(CDILV_TABLE.postComments)
      .insert({
        post_id: postId,
        user_id: user.id,
        content: trimmedContent,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Award +1 score point for union member
    const { data: post } = await publicDb
      .from(CDILV_TABLE.posts)
      .select("title")
      .eq("id", postId)
      .maybeSingle();

    const postTitle = post?.title
      ? `"${post.title.length > 35 ? post.title.slice(0, 35) + "..." : post.title}"`
      : "Bài viết";

    try {
      const awardLabel = `post_comment_${newComment.id}`;
      await publicDb.from(CDILV_TABLE.scoreEvents).insert({
        user_id: user.id,
        points: 1,
        note: `Thưởng bình luận bài viết: ${postTitle} (+1đ)`,
        award_label: awardLabel,
      });
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

    const publicDb = createPublicClient();

    // Check user role
    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = me?.role === "admin";

    // Fetch existing comment
    const { data: comment, error: fetchErr } = await publicDb
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
    const { error: delErr } = await publicDb
      .from(CDILV_TABLE.postComments)
      .delete()
      .eq("id", commentId);

    if (delErr) {
      throw delErr;
    }

    // Revoke awarded score point
    try {
      await publicDb
        .from(CDILV_TABLE.scoreEvents)
        .delete()
        .eq("award_label", `post_comment_${commentId}`);
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
