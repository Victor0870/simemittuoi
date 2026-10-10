"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PostComment } from "@/lib/data/posts";

type PostCommentsSectionProps = {
  postId: string;
  postTitle?: string;
  initialComments: PostComment[];
};

export function PostCommentsSection({
  postId,
  postTitle,
  initialComments,
}: PostCommentsSectionProps) {
  const { user, profile, isAdmin, isGuest, loading } = useAuth();

  const [comments, setComments] = useState<PostComment[]>(initialComments);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Comments submitted by the current user for this post
  const myComments = user ? comments.filter((c) => c.userId === user.id) : [];
  const myCommentCount = myComments.length;
  const isLimitReached = !isAdmin && myCommentCount >= 3;
  const remainingCount = Math.max(0, 3 - myCommentCount);

  function clearNoticeAfterTimeout() {
    setTimeout(() => {
      setNotice(null);
    }, 5000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!user) {
      setNotice({
        type: "error",
        text: "Vui lòng đăng nhập để gửi bình luận.",
      });
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      setNotice({
        type: "error",
        text: "Vui lòng nhập nội dung bình luận.",
      });
      return;
    }

    if (trimmed.length > 1000) {
      setNotice({
        type: "error",
        text: "Bình luận tối đa 1000 ký tự.",
      });
      return;
    }

    if (!isAdmin && myCommentCount >= 3) {
      setNotice({
        type: "error",
        text: "Bạn đã đạt tối đa 3 bình luận cho bài viết này.",
      });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const res = await fetch("/api/posts/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gửi bình luận không thành công.");
      }

      // Append new comment to local state
      const newComment: PostComment = {
        id: data.comment.id,
        postId: data.comment.post_id,
        userId: user.id,
        authorName: profile?.full_name || "Đoàn viên",
        authorAvatar: profile?.avatar_url || null,
        authorRole: profile?.role || "user",
        authorDepartment: profile?.department || null,
        authorCode: profile?.employee_code || null,
        content: trimmed,
        createdAt: new Date().toISOString(),
        timeAgo: "Vừa xong",
      };

      setComments((prev) => [...prev, newComment]);
      setContent("");
      setNotice({
        type: "success",
        text: data.message || "Bình luận thành công! Bạn nhận được +1 điểm thi đua.",
      });
      clearNoticeAfterTimeout();
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.message || "Đã xảy ra lỗi khi gửi bình luận.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (deletingId) return;

    const confirmed = window.confirm(
      "Bạn có chắc chắn muốn xóa bình luận này? Điểm thi đua (+1đ) tương ứng sẽ được thu hồi.",
    );
    if (!confirmed) return;

    setDeletingId(commentId);
    setNotice(null);

    try {
      const res = await fetch(`/api/posts/comments?id=${encodeURIComponent(commentId)}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể xóa bình luận.");
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setNotice({
        type: "success",
        text: data.message || "Đã xóa bình luận thành công.",
      });
      clearNoticeAfterTimeout();
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.message || "Đã xảy ra lỗi khi xóa bình luận.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border border-dusty-border/80 bg-surface-container-lowest p-5 sm:p-8 shadow-sm">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dusty-border/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MaterialIcon className="text-[22px]" name="forum" />
          </div>
          <div>
            <h2 className="text-title-lg sm:text-headline-sm font-bold text-on-surface">
              Bình luận trao đổi
            </h2>
            <p className="text-body-xs sm:text-body-sm text-on-surface-variant">
              Giao lưu, đóng góp ý kiến và nhận điểm thi đua phong trào
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-label-xs sm:text-label-sm font-bold text-amber-900 shadow-xs">
            <MaterialIcon className="text-[16px] text-amber-600" name="military_tech" />
            +1đ thi đua / bình luận
          </span>
          <span className="rounded-full bg-dusty-light px-3 py-1 text-label-xs sm:text-label-sm font-semibold text-primary">
            {comments.length} bình luận
          </span>
        </div>
      </div>

      {/* Rules Notice Pill */}
      <div className="flex items-start gap-2.5 rounded-xl border border-dusty-border/70 bg-gradient-to-r from-dusty-light/40 via-white to-white p-3 text-xs sm:text-body-sm text-on-surface-variant">
        <MaterialIcon className="shrink-0 text-[18px] text-primary" name="info" />
        <div className="leading-relaxed">
          <strong className="text-on-surface">Quy định bình luận: </strong>
          Đoàn viên được cộng <strong>+1 điểm thi đua</strong> cho mỗi bình luận. Giới hạn{" "}
          <strong>tối đa 3 bình luận</strong> cho mỗi đoàn viên trên một bài viết. Quản trị viên
          không bị giới hạn.
        </div>
      </div>

      {/* Alert Banner */}
      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl p-3.5 text-sm font-semibold animate-in fade-in duration-200 ${
            notice.type === "success"
              ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border border-red-300 bg-red-50 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <MaterialIcon
              className="text-[20px]"
              name={notice.type === "success" ? "check_circle" : "error"}
            />
            <span>{notice.text}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="text-on-surface-variant hover:text-on-surface"
            type="button"
          >
            <MaterialIcon className="text-[16px]" name="close" />
          </button>
        </div>
      )}

      {/* Input box or Login prompt */}
      {loading ? (
        <div className="h-28 animate-pulse rounded-2xl bg-surface-container" />
      ) : isGuest ? (
        /* Guest view: Prompt login */
        <div className="rounded-2xl border border-dashed border-primary/40 bg-gradient-to-br from-dusty-light/60 via-white to-white p-5 sm:p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MaterialIcon className="text-[28px]" name="lock_open" />
          </div>
          <h3 className="text-base sm:text-title-md font-bold text-on-surface">
            Đăng nhập để tham gia bình luận
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs sm:text-body-sm text-on-surface-variant">
            Chỉ thành viên đã đăng ký tài khoản Đoàn viên mới có quyền đăng bình luận và nhận
            ngay <strong>+1 điểm thi đua</strong>.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/login?next=/posts/${postId}`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark"
            >
              <MaterialIcon className="text-[18px]" name="login" />
              Đăng nhập ngay
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl border border-dusty-border bg-white px-4 py-2.5 text-sm font-bold text-on-surface transition hover:bg-dusty-light/50"
            >
              Đăng ký tài khoản
            </Link>
          </div>
        </div>
      ) : (
        /* Logged-in view */
        <div className="space-y-3">
          {/* Status info bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-body-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-on-surface">
                {profile?.full_name || user?.email}
              </span>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-label-xs font-bold text-amber-900">
                  <MaterialIcon className="text-[12px] text-amber-600" name="shield" />
                  Quản trị viên (Không giới hạn)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-dusty-border bg-dusty-light px-2 py-0.5 text-label-xs font-semibold text-primary">
                  {profile?.department || "Đoàn viên"}
                </span>
              )}
            </div>

            {!isAdmin && (
              <div className="flex items-center gap-1.5 font-medium">
                {isLimitReached ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-label-xs font-bold text-red-800">
                    <MaterialIcon className="text-[13px]" name="block" />
                    Đã đạt tối đa 3/3 bình luận
                  </span>
                ) : (
                  <span className="text-on-surface-variant">
                    Đã bình luận:{" "}
                    <strong className="text-primary">{myCommentCount}/3</strong> (Còn{" "}
                    <strong>{remainingCount}</strong> lượt)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Comment Form or Max Reached Banner */}
          {isLimitReached ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950">
              <MaterialIcon className="shrink-0 text-[24px] text-emerald-600" name="task_alt" />
              <div className="text-xs sm:text-body-sm">
                <p className="font-bold">Bạn đã đăng đủ 3 bình luận cho bài viết này!</p>
                <p className="text-emerald-800">
                  Toàn bộ điểm thi đua (+3đ) đã được ghi nhận. Cảm ơn sự tích cực đóng góp và thảo
                  luận sôi nổi của bạn!
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Viết bình luận, ý kiến đóng góp hoặc lời chúc của bạn... (+1đ thi đua)"
                  rows={3}
                  maxLength={1000}
                  disabled={submitting}
                  className="w-full rounded-2xl border border-dusty-border bg-white p-3.5 sm:p-4 text-body-sm sm:text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-surface-container"
                />
                <div className="absolute bottom-3 right-3 text-[11px] text-on-surface-variant">
                  {content.length}/1000
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">
                  Mỗi bình luận tích lũy ngay <strong>+1 điểm thi đua</strong>
                </span>

                <button
                  type="submit"
                  disabled={submitting || !content.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 sm:px-5 sm:py-2.5 text-label-sm sm:text-label-md font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <MaterialIcon className="text-[18px]" name="send" />
                      <span>Gửi bình luận (+1đ)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4 pt-3">
        {comments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dusty-border/80 bg-white/50 p-8 text-center">
            <MaterialIcon
              className="mx-auto mb-2 text-[36px] text-on-surface-variant/40"
              name="chat_bubble_outline"
            />
            <p className="text-body-sm font-medium text-on-surface-variant">
              Chưa có bình luận nào cho bài viết này.
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant/70">
              Hãy là người đầu tiên để lại ý kiến đóng góp!
            </p>
          </div>
        ) : (
          <ul className="space-y-3.5">
            {comments.map((comment) => {
              const isAuthor = user && user.id === comment.userId;
              const canDelete = isAdmin || isAuthor;
              const isCommentAdmin = comment.authorRole === "admin";
              const initial = (comment.authorName || "?").slice(0, 1).toUpperCase();

              return (
                <li
                  key={comment.id}
                  className={`group relative rounded-2xl border p-4 sm:p-5 transition-colors ${
                    isAuthor
                      ? "border-primary/30 bg-primary/[0.02]"
                      : "border-dusty-border/70 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* User info */}
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dusty-border bg-dusty-light font-bold text-primary">
                        {comment.authorAvatar ? (
                          <img
                            src={comment.authorAvatar}
                            alt={comment.authorName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{initial}</span>
                        )}
                      </div>

                      {/* Name & metadata */}
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="font-bold text-on-surface text-body-sm sm:text-body-md">
                            {comment.authorName}
                          </span>

                          {isCommentAdmin ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.2 text-[10px] sm:text-label-xs font-bold text-amber-900">
                              <MaterialIcon className="text-[12px] text-amber-600" name="shield" />
                              Quản trị viên
                            </span>
                          ) : comment.authorDepartment ? (
                            <span className="inline-flex items-center rounded-full border border-dusty-border bg-dusty-light px-2 py-0.2 text-[10px] sm:text-label-xs font-medium text-on-surface-variant">
                              {comment.authorDepartment}
                            </span>
                          ) : null}

                          {comment.authorCode && (
                            <span className="text-[11px] text-on-surface-variant/70">
                              · {comment.authorCode}
                            </span>
                          )}

                          {isAuthor && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.2 text-[10px] font-bold text-primary">
                              Bạn
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[11px] sm:text-xs text-on-surface-variant">
                          <MaterialIcon className="text-[13px]" name="schedule" />
                          <span>{comment.timeAgo}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete button (for admin or author) */}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        title={isAdmin && !isAuthor ? "Xóa bình luận (Quyền Admin)" : "Xóa bình luận của bạn"}
                        className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-red-50 hover:text-red-600 transition"
                        type="button"
                      >
                        {deletingId === comment.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                        ) : (
                          <MaterialIcon className="text-[18px]" name="delete_outline" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Comment content */}
                  <div className="mt-3 pl-0 sm:pl-[52px]">
                    <p className="whitespace-pre-wrap break-words text-body-sm sm:text-body-md leading-relaxed text-on-surface">
                      {comment.content}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
