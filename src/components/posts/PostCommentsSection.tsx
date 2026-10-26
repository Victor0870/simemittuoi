"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/client";
import { CDILV_STORAGE } from "@/lib/supabase/tables";
import type { PostComment } from "@/lib/data/posts";
import { downloadImageFile, parseCommentContent } from "@/lib/post-comment-content";
import { AdminShortcutLink } from "@/components/admin/AdminShortcutLink";

type PostCommentsSectionProps = {
  postId: string;
  postTitle?: string;
  isContest?: boolean;
  contestPrompt?: string | null;
  initialCommentCount?: number;
  initialComments?: PostComment[];
};

export function PostCommentsSection({
  postId,
  postTitle,
  isContest = false,
  contestPrompt = null,
  initialCommentCount = 0,
  initialComments,
}: PostCommentsSectionProps) {
  const { user, profile, isAdmin, isApproved, loading: authLoading } = useAuth();

  const [commentCount, setCommentCount] = useState<number>(
    initialCommentCount ?? initialComments?.length ?? 0,
  );
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Đính kèm ảnh thiết kế logo / tác phẩm
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Tải ảnh về máy
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  // Popup hiển thị quy định bình luận (khi bình luận lần thứ 4 hoặc bấm xem quy định)
  const [showRulePopup, setShowRulePopup] = useState(false);

  const [replyTarget, setReplyTarget] = useState<{ rootId: string; commentId: string; authorName: string } | null>(
    null,
  );
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Đóng modal quy định bình luận khi nhấn Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showRulePopup) {
        setShowRulePopup(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showRulePopup]);

  // Fetch comments only when user is an approved member
  useEffect(() => {
    if (authLoading) return;

    if (!isApproved) {
      setComments([]);
      setHasLoaded(true);
      return;
    }

    let isMounted = true;
    setLoadingComments(true);

    fetch(`/api/posts/comments?postId=${encodeURIComponent(postId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.comments && Array.isArray(data.comments)) {
          setComments(data.comments);
          if (typeof data.totalCount === "number") {
            setCommentCount(data.totalCount);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load comments:", err);
      })
      .finally(() => {
        if (isMounted) {
          setLoadingComments(false);
          setHasLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [postId, authLoading, isApproved]);

  const rootComments = useMemo(() => comments.filter((c) => !c.parentId), [comments]);
  const repliesByRoot = useMemo(() => {
    const map = new Map<string, PostComment[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      map.set(c.parentId, [...(map.get(c.parentId) ?? []), c]);
    }
    return map;
  }, [comments]);
  const nameByUser = useMemo(() => new Map(comments.map((c) => [c.userId, c.authorName])), [comments]);

  // Comments submitted by the current user for this post
  const myComments = user ? rootComments.filter((c) => c.userId === user.id) : [];
  const myCommentCount = myComments.length;
  const isLimitReached = !isAdmin && myCommentCount >= 3;
  const remainingCount = Math.max(0, 3 - myCommentCount);

  function clearNoticeAfterTimeout() {
    setTimeout(() => {
      setNotice(null);
    }, 5000);
  }

  // Tải một ảnh về máy
  async function handleDownloadImage(url: string, filename: string) {
    setDownloadingUrl(url);
    try {
      await downloadImageFile(url, filename);
    } finally {
      setDownloadingUrl(null);
    }
  }

  // Thả biểu tượng cảm xúc (Like, Tim, Haha)
  async function handleReact(commentId: string, reactionType: "like" | "heart" | "haha") {
    if (!user) {
      setNotice({
        type: "error",
        text: "Vui lòng đăng nhập để bày tỏ cảm xúc với bình luận.",
      });
      return;
    }

    if (!isApproved) {
      setNotice({
        type: "error",
        text: "Tài khoản của bạn đang chờ phê duyệt để tương tác.",
      });
      return;
    }

    // Cập nhật giao diện tức thì (Optimistic update)
    const prevComments = [...comments];
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;

        const currentReaction = c.userReaction;
        const currentReactions = { ...(c.reactions || { like: 0, heart: 0, haha: 0 }) };

        let nextUserReaction: "like" | "heart" | "haha" | null = reactionType;

        if (currentReaction === reactionType) {
          // Bấm lại biểu tượng đã chọn -> Bỏ thả cảm xúc
          nextUserReaction = null;
          currentReactions[reactionType] = Math.max(0, (currentReactions[reactionType] || 0) - 1);
        } else {
          // Nếu trước đó đã thả cảm xúc khác, giảm cảm xúc cũ
          if (currentReaction && currentReactions[currentReaction]) {
            currentReactions[currentReaction] = Math.max(0, currentReactions[currentReaction] - 1);
          }
          // Tăng cảm xúc mới
          currentReactions[reactionType] = (currentReactions[reactionType] || 0) + 1;
        }

        return {
          ...c,
          userReaction: nextUserReaction,
          reactions: currentReactions,
        };
      }),
    );

    try {
      const res = await fetch("/api/posts/comments/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, reactionType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể gửi cảm xúc.");
      }

      // Đồng bộ dữ liệu chính xác từ máy chủ
      if (data.reactions) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  userReaction: data.userReaction,
                  reactions: data.reactions,
                }
              : c,
          ),
        );
      }
    } catch (err: any) {
      // Khôi phục trạng thái cũ nếu lỗi
      setComments(prevComments);
      setNotice({
        type: "error",
        text: err?.message || "Lỗi khi thả cảm xúc.",
      });
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user || !isApproved) {
      setNotice({
        type: "error",
        text: isContest
          ? "Chỉ thành viên đã được duyệt mới có quyền tải ảnh tác phẩm."
          : "Chỉ thành viên đã được duyệt mới có quyền đính kèm hình ảnh.",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      setNotice({
        type: "error",
        text: "Vui lòng chọn tệp định dạng hình ảnh (PNG, JPG, JPEG, WEBP).",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice({
        type: "error",
        text: "Dung lượng ảnh tối đa là 5MB.",
      });
      return;
    }

    setUploadingImage(true);
    setNotice(null);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const filePrefix = isContest ? "logo" : "comment";
      const cleanFileName = `${filePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = `${user.id}/${cleanFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(CDILV_STORAGE.avatars)
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        throw uploadError;
      }

      const { data: pub } = supabase.storage
        .from(CDILV_STORAGE.avatars)
        .getPublicUrl(filePath);

      setAttachedImageUrl(pub.publicUrl);
      setNotice({
        type: "success",
        text: isContest
          ? "Đã tải ảnh lên thành công! Hãy viết vài câu thuyết minh ý nghĩa Logo rồi gửi bình luận."
          : "Đã tải ảnh đính kèm lên thành công! Bạn có thể nhập thêm nội dung rồi gửi bình luận.",
      });
      clearNoticeAfterTimeout();
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err?.message || "Không thể tải ảnh lên. Bạn cũng có thể dán đường dẫn ảnh trực tiếp.",
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || uploadingImage) return;

    if (!user || !isApproved) {
      setNotice({
        type: "error",
        text: "Chỉ thành viên đã được phê duyệt mới có quyền gửi bình luận.",
      });
      return;
    }

    const trimmed = content.trim();
    if (!trimmed && !attachedImageUrl) {
      setNotice({
        type: "error",
        text: isContest
          ? "Vui lòng nhập nội dung thuyết minh hoặc tải ảnh thiết kế logo."
          : "Vui lòng nhập nội dung bình luận hoặc đính kèm hình ảnh.",
      });
      return;
    }

    // Ghép ảnh đính kèm vào nội dung
    const attachmentLabel = isContest ? "Ảnh thiết kế Logo" : "Ảnh đính kèm";
    const fullContent = attachedImageUrl
      ? trimmed
        ? `${trimmed}\n\n[${attachmentLabel}]: ${attachedImageUrl}`
        : `[${attachmentLabel}]: ${attachedImageUrl}`
      : trimmed;

    if (fullContent.length > 3500) {
      setNotice({
        type: "error",
        text: "Bình luận quá dài (tối đa 3500 ký tự).",
      });
      return;
    }

    if (!isAdmin && myCommentCount >= 3) {
      setShowRulePopup(true);
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const res = await fetch("/api/posts/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content: fullContent }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error && data.error.includes("tối đa 3 bình luận")) {
          setShowRulePopup(true);
          return;
        }
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
        content: fullContent,
        createdAt: new Date().toISOString(),
        timeAgo: "Vừa xong",
      };

      setComments((prev) => [...prev, newComment]);
      setCommentCount((prev) => prev + 1);
      setContent("");
      setAttachedImageUrl(null);
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

  function startReply(comment: PostComment) {
    setReplyTarget({
      rootId: comment.parentId ?? comment.id,
      commentId: comment.id,
      authorName: comment.authorName,
    });
    setReplyText("");
    setReplyError(null);
  }

  async function handleSubmitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyTarget || replySubmitting || !user) return;
    const trimmed = replyText.trim();
    if (!trimmed) return;

    setReplySubmitting(true);
    setReplyError(null);
    try {
      const res = await fetch("/api/posts/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content: trimmed, parentId: replyTarget.commentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gửi phản hồi không thành công.");

      const reply: PostComment = {
        id: data.comment.id,
        postId: data.comment.post_id,
        userId: user.id,
        authorName: profile?.full_name || "Đoàn viên",
        authorAvatar: profile?.avatar_url || null,
        authorRole: profile?.role || "user",
        authorDepartment: profile?.department || null,
        authorCode: profile?.employee_code || null,
        content: data.comment.content,
        createdAt: data.comment.created_at,
        timeAgo: "Vừa xong",
        parentId: data.comment.parent_id,
        replyToUserId: data.comment.reply_to_user_id,
      };
      setComments((prev) => [...prev, reply]);
      setCommentCount((prev) => prev + 1);
      setReplyTarget(null);
      setReplyText("");
    } catch (err: any) {
      setReplyError(err?.message || "Đã xảy ra lỗi khi gửi phản hồi.");
    } finally {
      setReplySubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (deletingId) return;

    const target = comments.find((c) => c.id === commentId);
    const isReply = Boolean(target?.parentId);
    const confirmed = window.confirm(
      isReply
        ? "Bạn có chắc chắn muốn xóa phản hồi này?"
        : "Bạn có chắc chắn muốn xóa bình luận này? Điểm thi đua (+1đ) tương ứng và các phản hồi bên dưới sẽ bị xóa theo.",
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

      const removed = comments.filter((c) => c.id === commentId || c.parentId === commentId).length;
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
      setCommentCount((prev) => Math.max(0, prev - Math.max(1, removed)));
      if (replyTarget && (replyTarget.commentId === commentId || replyTarget.rootId === commentId)) {
        setReplyTarget(null);
      }
      if (!isReply) {
        setNotice({
          type: "success",
          text: data.message || "Đã xóa bình luận thành công.",
        });
        clearNoticeAfterTimeout();
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.message || "Đã xảy ra lỗi khi xóa bình luận.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  function renderReply(reply: PostComment) {
    const isAuthor = user?.id === reply.userId;
    const replyToName =
      reply.replyToUserId && reply.replyToUserId !== reply.userId ? nameByUser.get(reply.replyToUserId) : null;
    const parsed = parseCommentContent(reply.content);
    const reactionButtons: { type: "like" | "heart" | "haha"; emoji: string; active: string }[] = [
      { type: "like", emoji: "👍", active: "border-blue-400 bg-blue-50 text-blue-700" },
      { type: "heart", emoji: "❤️", active: "border-rose-400 bg-rose-50 text-rose-700" },
      { type: "haha", emoji: "😆", active: "border-amber-400 bg-amber-50 text-amber-700" },
    ];

    return (
      <div
        key={reply.id}
        className={`rounded-xl border p-3 ${isAuthor ? "border-primary/25 bg-primary/[0.02]" : "border-dusty-border/60 bg-white"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dusty-border bg-dusty-light text-xs font-bold text-primary">
              {reply.authorAvatar ? (
                <img src={reply.authorAvatar} alt={reply.authorName} className="h-full w-full object-cover" />
              ) : (
                <span>{(reply.authorName || "?").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1 text-xs font-bold text-on-surface">
                {reply.authorName}
                {isAuthor && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">Bạn</span>
                )}
              </p>
              <p className="text-[10px] text-on-surface-variant">{reply.timeAgo}</p>
            </div>
          </div>
          {(isAdmin || isAuthor) && (
            <button
              onClick={() => handleDelete(reply.id)}
              disabled={deletingId === reply.id}
              title="Xóa phản hồi"
              className="rounded-lg p-1 text-on-surface-variant/60 transition hover:bg-red-50 hover:text-red-600"
              type="button"
            >
              <MaterialIcon className="text-[16px]" name="delete_outline" />
            </button>
          )}
        </div>

        <p className="mt-1.5 whitespace-pre-wrap break-words text-body-sm leading-relaxed text-on-surface">
          {replyToName && <span className="mr-1 font-semibold text-primary">@{replyToName}</span>}
          {parsed.cleanText}
        </p>
        {parsed.imageUrls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {parsed.imageUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt="Ảnh trong phản hồi" className="max-h-40 rounded-lg border border-dusty-border" loading="lazy" />
              </a>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {reactionButtons.map((r) => {
            const count = reply.reactions?.[r.type] ?? 0;
            const active = reply.userReaction === r.type;
            return (
              <button
                key={r.type}
                type="button"
                onClick={() => handleReact(reply.id, r.type)}
                className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
                  active ? r.active : "border-dusty-border/70 bg-surface-container-lowest text-on-surface-variant hover:bg-dusty-light"
                }`}
              >
                <span>{r.emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => startReply(reply)}
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant transition hover:text-primary"
          >
            <MaterialIcon className="text-[14px]" name="reply" />
            Trả lời
          </button>
        </div>
      </div>
    );
  }

  function renderReplyForm() {
    if (!replyTarget) return null;
    return (
      <form onSubmit={handleSubmitReply} className="space-y-2">
        <div className="flex items-end gap-2">
          <textarea
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setReplyTarget(null);
            }}
            rows={2}
            maxLength={3000}
            disabled={replySubmitting}
            placeholder={`Trả lời ${replyTarget.authorName}...`}
            className="flex-1 resize-none rounded-xl border border-dusty-border bg-white p-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:bg-surface-container"
          />
          <div className="flex shrink-0 flex-col gap-1.5">
            <button
              type="submit"
              disabled={replySubmitting || !replyText.trim()}
              aria-label="Gửi phản hồi"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-xs transition hover:bg-dusty-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {replySubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <MaterialIcon className="text-[18px]" name="send" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              aria-label="Hủy trả lời"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-dusty-border text-on-surface-variant transition hover:bg-surface-container"
            >
              <MaterialIcon className="text-[18px]" name="close" />
            </button>
          </div>
        </div>
        {replyError && <p className="text-xs font-semibold text-red-700">{replyError}</p>}
      </form>
    );
  }

  return (
    <section
      id="comments"
      className="scroll-mt-24 space-y-6 rounded-2xl border border-dusty-border/80 bg-surface-container-lowest p-5 sm:p-8 shadow-sm"
    >
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
              Giao lưu, đóng góp ý kiến và nhận điểm thi đua
            </p>
          </div>
        </div>

        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => setShowRulePopup(true)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-left text-label-xs sm:text-label-sm font-bold leading-tight text-amber-900 shadow-xs hover:bg-amber-100 transition"
            title="Bấm để xem quy định bình luận"
          >
            <MaterialIcon className="shrink-0 text-[16px] text-amber-600" name="military_tech" />
            <span>
              <span className="block whitespace-nowrap sm:inline">+1đ thi đua /</span>
              <span className="hidden sm:inline"> </span>
              <span className="block whitespace-nowrap sm:inline">bình luận</span>
            </span>
            <MaterialIcon className="shrink-0 text-[14px] text-amber-700/70 ml-0.5" name="info" />
          </button>
          <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-transparent bg-dusty-light px-3 py-1 text-center text-label-xs sm:text-label-sm font-semibold leading-tight text-primary">
            {commentCount} bình luận
          </span>
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

      {/* MAIN CONTENT AREA */}
      {authLoading ? (
        /* Loading Auth State */
        <div className="h-32 animate-pulse rounded-2xl bg-surface-container/60" />
      ) : !isApproved ? (
        /* NON-MEMBER / GUEST / PENDING / REJECTED VIEW */
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-dusty-light/60 via-white to-primary/5 p-6 sm:p-8 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs ring-4 ring-primary/5">
            <MaterialIcon className="text-[32px]" name="lock" />
          </div>

          <h3 className="text-lg sm:text-title-lg font-bold text-on-surface">
            Nội dung bình luận chỉ dành cho thành viên
          </h3>

          <p className="mx-auto mt-2 max-w-lg text-body-sm sm:text-body-md text-on-surface-variant leading-relaxed">
            Bài viết hiện có{" "}
            <strong className="font-bold text-primary">{commentCount} bình luận</strong> trao đổi.{" "}
            {isContest
              ? "Vui lòng đăng ký hoặc đăng nhập tài khoản thành viên Đoàn cơ sở để được đọc toàn bộ bình luận, xem các tác phẩm thiết kế và tham gia đóng góp ý kiến."
              : "Vui lòng đăng ký hoặc đăng nhập tài khoản thành viên Đoàn cơ sở để được đọc toàn bộ bình luận và tham gia trao đổi, đóng góp ý kiến."}
          </p>

          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-semibold text-amber-900">
            <MaterialIcon className="text-[16px] text-amber-600" name="military_tech" />
            Tham gia bình luận tích luỹ ngay +1 điểm thi đua / bình luận
          </div>

          {!user ? (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark"
              >
                <MaterialIcon className="text-[18px]" name="person_add" />
                Đăng ký thành viên
              </Link>
              <Link
                href={`/login?next=/posts/${postId}`}
                className="inline-flex items-center gap-2 rounded-xl border border-dusty-border bg-white px-5 py-2.5 text-sm font-bold text-on-surface transition hover:bg-dusty-light"
              >
                <MaterialIcon className="text-[18px]" name="login" />
                Đã có tài khoản? Đăng nhập
              </Link>
            </div>
          ) : profile?.approval_status === "pending" ? (
            <div className="mt-5 mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-center text-amber-950">
              <div className="flex items-center justify-center gap-2 font-bold text-amber-900 text-sm">
                <MaterialIcon className="text-[18px] text-amber-700" name="hourglass_top" />
                Tài khoản đang chờ duyệt thành viên
              </div>
              <p className="mt-1.5 text-xs text-amber-800 leading-relaxed">
                Hồ sơ của bạn (<strong>{profile?.full_name || user.email}</strong>) đang được Ban
                chấp hành xem xét phê duyệt.{" "}
                {isContest
                  ? "Sau khi được duyệt, bạn sẽ có thể xem toàn bộ bình luận, gửi mẫu thiết kế Logo và nhận điểm thi đua."
                  : "Sau khi được duyệt, bạn sẽ có thể xem toàn bộ bình luận, tham gia đóng góp ý kiến và nhận điểm thi đua."}
              </p>
            </div>
          ) : profile?.approval_status === "rejected" ? (
            <div className="mt-5 mx-auto max-w-md rounded-xl border border-red-300 bg-red-50 p-4 text-center text-red-950">
              <div className="flex items-center justify-center gap-2 font-bold text-red-900 text-sm">
                <MaterialIcon className="text-[18px] text-red-600" name="cancel" />
                Tài khoản chưa được phê duyệt
              </div>
              <p className="mt-1 text-xs text-red-800">
                Vui lòng liên hệ Ban chấp hành Đoàn cơ sở để được hỗ trợ kích hoạt tài khoản đoàn viên.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        /* MEMBER VIEW: Thành viên chính thức đã được phê duyệt */
        <div className="space-y-6">
          {/* Member comment form or Limit reached */}
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
                    <button
                      type="button"
                      onClick={() => setShowRulePopup(true)}
                      className="cursor-pointer inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-label-xs font-bold text-red-800 hover:bg-red-200 transition"
                      title="Bấm để xem quy định bình luận"
                    >
                      <MaterialIcon className="text-[13px]" name="block" />
                      Đã đạt tối đa 3/3 bình luận (Xem quy định)
                    </button>
                  ) : (
                    <span className="text-on-surface-variant">
                      Đã bình luận:{" "}
                      <strong className="text-primary">{myCommentCount}/3</strong> (Còn{" "}
                      <strong>{remainingCount}</strong> lượt gửi)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Form bình luận */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onClick={() => {
                    if (isLimitReached) {
                      setShowRulePopup(true);
                    }
                  }}
                  placeholder={
                    isLimitReached
                      ? "Bạn đã đăng đủ 3/3 bình luận. Bấm vào đây hoặc bấm Gửi để xem quy định..."
                      : isContest
                        ? contestPrompt?.trim() ||
                          "Viết lời bình luận, ý kiến đóng góp hoặc thuyết minh ý nghĩa mẫu thiết kế Logo... (+1đ thi đua)"
                        : "Viết bình luận, chia sẻ ý kiến của bạn về bài viết... (+1đ thi đua)"
                  }
                  rows={3}
                  maxLength={3000}
                  disabled={submitting || uploadingImage}
                  className="w-full rounded-2xl border border-dusty-border bg-white p-3.5 sm:p-4 text-body-sm sm:text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-surface-container"
                />
                <div className="absolute bottom-3 right-3 text-[11px] text-on-surface-variant">
                  {content.length}/3000
                </div>
              </div>

              {/* Khung xem trước ảnh đính kèm (nếu có) */}
              {attachedImageUrl && (
                <div className="relative inline-flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.03] p-2.5 shadow-2xs">
                  <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-dusty-border bg-white shadow-xs">
                    <img
                      src={attachedImageUrl}
                      alt="Ảnh đính kèm"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-on-surface">
                      {isContest ? "Đã đính kèm ảnh thiết kế Logo" : "Đã đính kèm hình ảnh"}
                    </p>
                    <p className="text-on-surface-variant">Ảnh sẽ được đăng cùng bình luận</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedImageUrl(null)}
                    title="Gỡ ảnh"
                    className="ml-2 rounded-full p-1 text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition"
                  >
                    <MaterialIcon className="text-[18px]" name="close" />
                  </button>
                </div>
              )}

              {/* Input file ẩn */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  {/* Nút đính kèm ảnh */}
                  <button
                    type="button"
                    disabled={uploadingImage || submitting}
                    onClick={() => {
                      if (isLimitReached) {
                        setShowRulePopup(true);
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-dusty-border bg-white px-3.5 py-2 text-xs sm:text-label-sm font-semibold text-on-surface transition hover:bg-dusty-light disabled:opacity-50"
                  >
                    {uploadingImage ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span>Đang tải ảnh...</span>
                      </>
                    ) : (
                      <>
                        <MaterialIcon className="text-[18px] text-primary" name="add_photo_alternate" />
                        <span>{isContest ? "Đính kèm ảnh Logo" : "Đính kèm ảnh"}</span>
                      </>
                    )}
                  </button>

                  <span className="text-xs text-on-surface-variant hidden sm:inline">
                    Mỗi bình luận tích lũy ngay <strong>+1 điểm thi đua</strong>
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting || uploadingImage || (!content.trim() && !attachedImageUrl && !isLimitReached)}
                  onClick={(e) => {
                    if (isLimitReached) {
                      e.preventDefault();
                      setShowRulePopup(true);
                    }
                  }}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 sm:px-5 sm:py-2.5 text-label-sm sm:text-label-md font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>

          {isContest ? (
            <div className="flex justify-end">
              <AdminShortcutLink
                href={`/admin/content/posts/submissions/${encodeURIComponent(postId)}`}
                icon="palette"
                label="Tổng hợp tác phẩm dự thi"
              />
            </div>
          ) : null}

          {/* Member Comments List */}
          <div className="space-y-4 pt-2">
            {loadingComments ? (
              <div className="space-y-3">
                <div className="h-20 animate-pulse rounded-2xl bg-surface-container/60" />
                <div className="h-20 animate-pulse rounded-2xl bg-surface-container/60" />
              </div>
            ) : comments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-dusty-border/80 bg-white/50 p-8 text-center">
                <MaterialIcon
                  className="mx-auto mb-2 text-[36px] text-on-surface-variant/40"
                  name="chat_bubble_outline"
                />
                <p className="text-body-sm font-medium text-on-surface-variant">
                  {isContest
                    ? "Chưa có bình luận hoặc tác phẩm nào cho bài viết này."
                    : "Chưa có bình luận nào cho bài viết này."}
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant/70">
                  {isContest
                    ? "Hãy là người đầu tiên gửi ý kiến đóng góp hoặc gửi tác phẩm thiết kế Logo dự thi!"
                    : "Hãy là người đầu tiên viết bình luận và chia sẻ ý kiến của bạn!"}
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {rootComments.map((comment) => {
                  const isAuthor = user && user.id === comment.userId;
                  const canDelete = isAdmin || isAuthor;
                  const initial = (comment.authorName || "?").slice(0, 1).toUpperCase();
                  const parsed = parseCommentContent(comment.content);

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

                              {comment.authorDepartment ? (
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
                            title={
                              isAdmin && !isAuthor
                                ? "Xóa bình luận (Quyền Admin)"
                                : "Xóa bình luận của bạn"
                            }
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

                      {/* Comment content & Images */}
                      <div className="mt-3 pl-0 sm:pl-[52px] space-y-3">
                        {parsed.cleanText && (
                          <p className="whitespace-pre-wrap break-words text-body-sm sm:text-body-md leading-relaxed text-on-surface">
                            {parsed.cleanText}
                          </p>
                        )}

                        {/* Danh sách ảnh đính kèm */}
                        {parsed.imageUrls.length > 0 && (
                          <div className="flex flex-wrap gap-3.5 pt-1">
                            {parsed.imageUrls.map((imgUrl, idx) => {
                              const authorClean = (comment.authorName || "tac_gia").replace(
                                /[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g,
                                "_",
                              );
                              const filePrefix = isContest ? "Logo_CDILV" : "Anh_binh_luan";
                              const downloadFilename = `${filePrefix}_${authorClean}_${comment.id.slice(0, 6)}${idx > 0 ? `_${idx + 1}` : ""}.png`;

                              return (
                                <div
                                  key={idx}
                                  className="group/img relative inline-block max-w-full overflow-hidden rounded-2xl border border-dusty-border bg-slate-50/80 shadow-xs"
                                >
                                  {/* Thanh công cụ ảnh: Tải về & Copy link & Xem ảnh gốc */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dusty-border/60 bg-white px-3 py-2 text-xs font-semibold text-on-surface-variant">
                                    <div className="flex items-center gap-1.5 text-primary">
                                      <MaterialIcon
                                        className="text-[16px]"
                                        name={isContest ? "palette" : "image"}
                                      />
                                      <span className="font-bold">
                                        {isContest ? "Mẫu thiết kế Logo" : "Ảnh đính kèm"}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {/* Nút Tải ảnh về máy (Download button) */}
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadImage(imgUrl, downloadFilename)}
                                        disabled={downloadingUrl === imgUrl}
                                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition hover:bg-dusty-dark disabled:opacity-50"
                                        title={
                                          isContest
                                            ? "Tải ảnh về máy để tạo cuộc bình chọn"
                                            : "Tải ảnh về máy"
                                        }
                                      >
                                        {downloadingUrl === imgUrl ? (
                                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        ) : (
                                          <MaterialIcon className="text-[14px]" name="download" />
                                        )}
                                        <span>Tải ảnh</span>
                                      </button>

                                      {/* Xem ảnh gốc */}
                                      <a
                                        href={imgUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] text-on-surface-variant hover:text-primary transition"
                                        title="Xem ảnh gốc trong tab mới"
                                      >
                                        <MaterialIcon className="text-[14px]" name="open_in_new" />
                                      </a>
                                    </div>
                                  </div>

                                  {/* Ảnh hiển thị */}
                                  <a
                                    href={imgUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-2.5 cursor-zoom-in bg-white hover:bg-slate-50 transition"
                                  >
                                    <img
                                      src={imgUrl}
                                      alt={
                                        isContest
                                          ? `Mẫu thiết kế Logo từ ${comment.authorName}`
                                          : `Ảnh đính kèm từ ${comment.authorName}`
                                      }
                                      className="max-h-84 w-auto rounded-lg object-contain transition-transform duration-200 group-hover/img:scale-[1.01]"
                                      loading="lazy"
                                    />
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Thanh biểu tượng cảm xúc (Like, Tim, Haha) */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2 pl-0 sm:pl-[52px] pt-1">
                        <button
                          type="button"
                          onClick={() => handleReact(comment.id, "like")}
                          title="Thích"
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold transition-all ${
                            comment.userReaction === "like"
                              ? "border border-blue-400 bg-blue-50 text-blue-700 shadow-2xs font-bold scale-105"
                              : "border border-dusty-border/70 bg-surface-container-lowest text-on-surface-variant hover:bg-dusty-light hover:text-blue-600"
                          }`}
                        >
                          <span className="text-[14px]">👍</span>
                          <span>Thích</span>
                          {(comment.reactions?.like ?? 0) > 0 && (
                            <span
                              className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[11px] ${
                                comment.userReaction === "like"
                                  ? "bg-blue-200/80 text-blue-900 font-bold"
                                  : "bg-dusty-light text-on-surface font-semibold"
                              }`}
                            >
                              {comment.reactions?.like}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReact(comment.id, "heart")}
                          title="Yêu thích"
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold transition-all ${
                            comment.userReaction === "heart"
                              ? "border border-rose-400 bg-rose-50 text-rose-700 shadow-2xs font-bold scale-105"
                              : "border border-dusty-border/70 bg-surface-container-lowest text-on-surface-variant hover:bg-dusty-light hover:text-rose-600"
                          }`}
                        >
                          <span className="text-[14px]">❤️</span>
                          <span>Tim</span>
                          {(comment.reactions?.heart ?? 0) > 0 && (
                            <span
                              className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[11px] ${
                                comment.userReaction === "heart"
                                  ? "bg-rose-200/80 text-rose-900 font-bold"
                                  : "bg-dusty-light text-on-surface font-semibold"
                              }`}
                            >
                              {comment.reactions?.heart}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReact(comment.id, "haha")}
                          title="Haha"
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold transition-all ${
                            comment.userReaction === "haha"
                              ? "border border-amber-400 bg-amber-50 text-amber-700 shadow-2xs font-bold scale-105"
                              : "border border-dusty-border/70 bg-surface-container-lowest text-on-surface-variant hover:bg-dusty-light hover:text-amber-600"
                          }`}
                        >
                          <span className="text-[14px]">😆</span>
                          <span>Haha</span>
                          {(comment.reactions?.haha ?? 0) > 0 && (
                            <span
                              className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[11px] ${
                                comment.userReaction === "haha"
                                  ? "bg-amber-200/80 text-amber-900 font-bold"
                                  : "bg-dusty-light text-on-surface font-semibold"
                              }`}
                            >
                              {comment.reactions?.haha}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => startReply(comment)}
                          className="inline-flex items-center gap-1 rounded-full border border-dusty-border/70 bg-surface-container-lowest px-2.5 sm:px-3 py-1 text-xs font-semibold text-on-surface-variant transition hover:bg-dusty-light hover:text-primary"
                        >
                          <MaterialIcon className="text-[15px]" name="reply" />
                          <span>Trả lời</span>
                        </button>

                        {/* Tổng số lượt tương tác nếu > 0 */}
                        {((comment.reactions?.like ?? 0) +
                          (comment.reactions?.heart ?? 0) +
                          (comment.reactions?.haha ?? 0)) > 0 && (
                          <span className="ml-auto text-[11px] font-medium text-on-surface-variant/70">
                            {(comment.reactions?.like ?? 0) +
                              (comment.reactions?.heart ?? 0) +
                              (comment.reactions?.haha ?? 0)}{" "}
                            tương tác
                          </span>
                        )}
                      </div>

                      {(repliesByRoot.get(comment.id)?.length || replyTarget?.rootId === comment.id) && (
                        <div className="mt-3 space-y-2.5 border-l-2 border-dusty-border/70 pl-3 sm:ml-[52px]">
                          {(repliesByRoot.get(comment.id) ?? []).map((reply) => renderReply(reply))}
                          {replyTarget?.rootId === comment.id && renderReplyForm()}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Modal Popup: Quy định bình luận (khi thành viên bình luận lần thứ 4 hoặc bấm xem quy định) */}
      {showRulePopup && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRulePopup(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="comment-rule-modal-title"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-dusty-border bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Nút đóng góc phải */}
            <button
              type="button"
              onClick={() => setShowRulePopup(false)}
              className="cursor-pointer absolute right-4 top-4 rounded-full p-1.5 text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
              aria-label="Đóng"
            >
              <MaterialIcon name="close" />
            </button>

            {/* Icon & Tiêu đề */}
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <MaterialIcon className="text-[26px]" name="info" />
              </div>
              <div>
                <h3 id="comment-rule-modal-title" className="text-title-md font-bold text-on-surface">
                  Quy định bình luận
                </h3>
                <p className="text-body-xs text-on-surface-variant">
                  Thông tin giới hạn lượt bình luận bài viết
                </p>
              </div>
            </div>

            {/* Nội dung quy định theo đúng nguyên văn */}
            <div className="mt-4 space-y-3 rounded-2xl border border-dusty-border/80 bg-surface-container-lowest/60 p-4 text-xs sm:text-body-sm leading-relaxed text-on-surface-variant">
              <p>
                Đoàn viên được cộng{" "}
                <strong className="font-bold text-amber-700">+1 điểm thi đua</strong> cho mỗi bình luận.
              </p>
              <p>
                Giới hạn{" "}
                <strong className="font-bold text-on-surface">tối đa 3 bình luận</strong> cho mỗi đoàn viên trên một bài viết
                {isContest ? " (cho phép gửi tối đa 3 mẫu thiết kế khác nhau)" : ""}. Quản trị viên không bị giới hạn.
              </p>
              {isLimitReached && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                    <MaterialIcon className="text-[17px] text-emerald-600" name="task_alt" />
                    Bạn đã đăng đủ 3/3 bình luận
                  </div>
                  <p className="mt-1 text-emerald-800">
                    Toàn bộ điểm thi đua (+3đ) đã được ghi nhận. Xin cảm ơn sự tích cực tham gia và đóng góp của bạn!
                  </p>
                </div>
              )}
            </div>

            {/* Nút hành động */}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRulePopup(false)}
                className="cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark hover:shadow-md"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
