"use client";

import { useEffect, useState } from "react";
import { ReactionButtons } from "@/components/albums/ReactionButtons";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  ALBUM_COMMENT_LIMIT,
  type AlbumPhoto,
  type AlbumPhotoComment,
  type AlbumSummary,
  type ReactionType,
} from "@/lib/data/albums";

type PhotoViewerModalProps = {
  album: AlbumSummary;
  photos: AlbumPhoto[];
  index: number;
  canManage: boolean;
  currentUserId: string;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onPhotoChange: (photoId: string, patch: Partial<AlbumPhoto>) => void;
  onPhotoDeleted: (photoId: string, message: string) => void;
  onSetCover: (photo: AlbumPhoto) => void;
};

type Notice = { type: "success" | "error"; text: string };

const COMMENT_REACTIONS: { type: ReactionType; emoji: string; label: string; active: string }[] = [
  { type: "like", emoji: "👍", label: "Thích", active: "border-blue-400 bg-blue-50 text-blue-700" },
  { type: "heart", emoji: "❤️", label: "Tim", active: "border-rose-400 bg-rose-50 text-rose-700" },
  { type: "haha", emoji: "😆", label: "Haha", active: "border-amber-400 bg-amber-50 text-amber-700" },
];

function Avatar({ name, url, size = "h-9 w-9" }: { name: string; url: string | null; size?: string }) {
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-dusty-border bg-dusty-light text-sm font-bold text-primary`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{(name || "?").slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}

export function PhotoViewerModal({
  album,
  photos,
  index,
  canManage,
  currentUserId,
  onNavigate,
  onClose,
  onPhotoChange,
  onPhotoDeleted,
  onSetCover,
}: PhotoViewerModalProps) {
  const photo = photos[index];
  const photoId = photo?.id;

  const [comments, setComments] = useState<AlbumPhotoComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [reactingCommentId, setReactingCommentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ rootId: string; commentId: string; authorName: string } | null>(
    null,
  );
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["TEXTAREA", "INPUT"].includes(target.tagName)) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, hasPrev, hasNext, onClose, onNavigate]);

  useEffect(() => {
    if (!photoId) return;
    let isMounted = true;
    setComments([]);
    setContent("");
    setNotice(null);
    setReplyTarget(null);
    setLoadingComments(true);

    fetch(`/api/albums/photos/comments?photoId=${encodeURIComponent(photoId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && Array.isArray(data.comments)) setComments(data.comments);
      })
      .catch((err) => console.error("Failed to load photo comments:", err))
      .finally(() => {
        if (isMounted) setLoadingComments(false);
      });

    return () => {
      isMounted = false;
    };
  }, [photoId]);

  if (!photo) return null;

  const isOwner = photo.userId === currentUserId;
  const rootComments = comments.filter((c) => !c.parentId);
  const nameByUser = new Map(comments.map((c) => [c.userId, c.authorName]));
  const myCommentCount = rootComments.filter((c) => c.userId === currentUserId).length;
  const isLimitReached = !canManage && myCommentCount >= ALBUM_COMMENT_LIMIT;

  async function reloadComments(id: string) {
    const listRes = await fetch(`/api/albums/photos/comments?photoId=${encodeURIComponent(id)}`);
    const listData = await listRes.json();
    if (Array.isArray(listData.comments)) {
      setComments(listData.comments);
      onPhotoChange(id, { commentCount: listData.comments.length });
    }
  }

  function startReply(c: AlbumPhotoComment) {
    setReplyTarget({ rootId: c.parentId ?? c.id, commentId: c.id, authorName: c.authorName });
    setReplyText("");
    setReplyError(null);
  }

  async function handleSubmitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyTarget || replySubmitting) return;
    const trimmed = replyText.trim();
    if (!trimmed) return;

    setReplySubmitting(true);
    setReplyError(null);
    try {
      const res = await fetch("/api/albums/photos/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, content: trimmed, parentId: replyTarget.commentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gửi phản hồi không thành công.");
      await reloadComments(photo.id);
      setReplyTarget(null);
      setReplyText("");
    } catch (err: any) {
      setReplyError(err?.message || "Đã xảy ra lỗi khi gửi phản hồi.");
    } finally {
      setReplySubmitting(false);
    }
  }

  async function handleReact(type: ReactionType) {
    if (reacting) return;
    const prev = { reactions: photo.reactions, userReaction: photo.userReaction };

    const nextReactions = { ...photo.reactions };
    let nextUserReaction: ReactionType | null = type;
    if (photo.userReaction === type) {
      nextUserReaction = null;
      nextReactions[type] = Math.max(0, nextReactions[type] - 1);
    } else {
      if (photo.userReaction) {
        nextReactions[photo.userReaction] = Math.max(0, nextReactions[photo.userReaction] - 1);
      }
      nextReactions[type] += 1;
    }
    onPhotoChange(photo.id, { reactions: nextReactions, userReaction: nextUserReaction });

    setReacting(true);
    try {
      const res = await fetch("/api/albums/photos/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, reactionType: type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể gửi cảm xúc.");
      onPhotoChange(photo.id, { reactions: data.reactions, userReaction: data.userReaction });
    } catch (err: any) {
      onPhotoChange(photo.id, prev);
      setNotice({ type: "error", text: err?.message || "Lỗi khi thả cảm xúc." });
    } finally {
      setReacting(false);
    }
  }

  async function handleCommentReact(commentId: string, type: ReactionType) {
    if (reactingCommentId) return;
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;
    const prev = { reactions: target.reactions, userReaction: target.userReaction };

    const nextReactions = { ...target.reactions };
    let nextUserReaction: ReactionType | null = type;
    if (target.userReaction === type) {
      nextUserReaction = null;
      nextReactions[type] = Math.max(0, nextReactions[type] - 1);
    } else {
      if (target.userReaction) {
        nextReactions[target.userReaction] = Math.max(0, nextReactions[target.userReaction] - 1);
      }
      nextReactions[type] += 1;
    }
    const patchComment = (patch: Pick<AlbumPhotoComment, "reactions" | "userReaction">) =>
      setComments((list) => list.map((c) => (c.id === commentId ? { ...c, ...patch } : c)));
    patchComment({ reactions: nextReactions, userReaction: nextUserReaction });

    setReactingCommentId(commentId);
    try {
      const res = await fetch("/api/albums/photos/comments/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, reactionType: type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể gửi cảm xúc.");
      patchComment({ reactions: data.reactions, userReaction: data.userReaction });
    } catch (err: any) {
      patchComment(prev);
      setNotice({ type: "error", text: err?.message || "Lỗi khi thả cảm xúc." });
    } finally {
      setReactingCommentId(null);
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (isLimitReached) {
      setNotice({
        type: "error",
        text: `Bạn đã đăng tối đa ${ALBUM_COMMENT_LIMIT} bình luận cho ảnh này.`,
      });
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/albums/photos/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, content: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gửi bình luận không thành công.");

      await reloadComments(photo.id);

      setContent("");
      setNotice({ type: "success", text: data.message || "Gửi bình luận thành công!" });
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Đã xảy ra lỗi khi gửi bình luận." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (deletingCommentId) return;
    const isReply = Boolean(comments.find((c) => c.id === commentId)?.parentId);
    const confirmText = isReply
      ? "Xóa phản hồi này?"
      : "Xóa bình luận này? Điểm thi đua (+1đ) tương ứng (nếu có) và các phản hồi bên dưới sẽ bị xóa theo.";
    if (!window.confirm(confirmText)) {
      return;
    }

    setDeletingCommentId(commentId);
    try {
      const res = await fetch(`/api/albums/photos/comments?id=${encodeURIComponent(commentId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể xóa bình luận.");

      const next = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
      setComments(next);
      onPhotoChange(photo.id, { commentCount: next.length });
      if (replyTarget && (replyTarget.commentId === commentId || replyTarget.rootId === commentId)) {
        setReplyTarget(null);
      }
      if (!isReply) setNotice({ type: "success", text: data.message || "Đã xóa bình luận." });
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Đã xảy ra lỗi khi xóa bình luận." });
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function handleDeletePhoto() {
    if (deletingPhoto) return;
    const confirmText =
      album.uploadPoints > 0
        ? "Xóa ảnh này? Điểm thi đua đã cộng cho ảnh và các bình luận của ảnh sẽ được thu hồi."
        : "Xóa ảnh này? Điểm bình luận của ảnh (nếu có) sẽ được thu hồi.";
    if (!window.confirm(confirmText)) return;

    setDeletingPhoto(true);
    try {
      const res = await fetch(`/api/albums/photos?id=${encodeURIComponent(photo.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể xóa ảnh.");
      onPhotoDeleted(photo.id, data.message || "Đã xóa ảnh.");
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Đã xảy ra lỗi khi xóa ảnh." });
      setDeletingPhoto(false);
    }
  }

  function renderComment(c: AlbumPhotoComment) {
    const canDelete = canManage || c.userId === currentUserId;
    const replyToName =
      c.parentId && c.replyToUserId && c.replyToUserId !== c.userId ? nameByUser.get(c.replyToUserId) : null;
    return (
      <div
        key={c.id}
        className={`rounded-xl border ${c.parentId ? "p-2.5" : "p-3"} ${
          c.userId === currentUserId ? "border-primary/30 bg-primary/[0.03]" : "border-dusty-border/70 bg-white"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={c.authorName} url={c.authorAvatar} size={c.parentId ? "h-6 w-6" : "h-7 w-7"} />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-on-surface">
                {c.authorName}              </p>
              <p className="text-[10px] text-on-surface-variant">{c.timeAgo}</p>
            </div>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={() => handleDeleteComment(c.id)}
              disabled={deletingCommentId === c.id}
              title={c.parentId ? "Xóa phản hồi" : "Xóa bình luận"}
              className="rounded-lg p-1 text-on-surface-variant/60 transition hover:bg-red-50 hover:text-red-600"
            >
              <MaterialIcon className="text-[16px]" name="delete_outline" />
            </button>
          )}
        </div>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-on-surface sm:text-body-sm">
          {replyToName && <span className="mr-1 font-semibold text-primary">@{replyToName}</span>}
          {c.content}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {COMMENT_REACTIONS.map((r) => {
            const count = c.reactions?.[r.type] ?? 0;
            const active = c.userReaction === r.type;
            return (
              <button
                key={r.type}
                type="button"
                onClick={() => handleCommentReact(c.id, r.type)}
                disabled={reactingCommentId === c.id}
                title={r.label}
                aria-label={r.label}
                aria-pressed={active}
                className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 ${
                  active
                    ? r.active
                    : "border-dusty-border/70 bg-surface-container-lowest text-on-surface-variant hover:bg-dusty-light"
                }`}
              >
                <span>{r.emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => startReply(c)}
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant transition hover:text-primary"
          >
            <MaterialIcon className="text-[14px]" name="reply" />
            Trả lời
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex bg-black/90 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        {/* Khu vực ảnh */}
        <div className="relative flex min-h-[55vh] flex-1 items-center justify-center p-3 md:min-h-0 md:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.id}
            src={photo.imageUrl}
            alt={photo.caption || `Ảnh của ${photo.authorName}`}
            className="max-h-[52vh] max-w-full rounded-lg object-contain shadow-2xl md:max-h-[90vh]"
          />

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/90 md:hidden"
          >
            <MaterialIcon className="text-[24px]" name="close" />
          </button>

          {hasPrev && (
            <button
              type="button"
              onClick={() => onNavigate(index - 1)}
              aria-label="Ảnh trước"
              className="absolute top-1/2 left-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30 md:left-4"
            >
              <MaterialIcon className="text-[28px]" name="chevron_left" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={() => onNavigate(index + 1)}
              aria-label="Ảnh tiếp theo"
              className="absolute top-1/2 right-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30 md:right-4"
            >
              <MaterialIcon className="text-[28px]" name="chevron_right" />
            </button>
          )}

          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
            {index + 1} / {photos.length}
          </span>
        </div>

        {/* Bảng thông tin, cảm xúc, bình luận */}
        <aside className="flex w-full flex-col bg-white md:h-full md:w-[400px] md:shrink-0">
          <div className="flex items-start justify-between gap-3 border-b border-dusty-border/70 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar name={photo.authorName} url={photo.authorAvatar} size="h-10 w-10" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-on-surface">{photo.authorName}</span>
                  {isOwner && (
                    <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                      Bạn
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  {photo.authorDepartment ? `${photo.authorDepartment} · ` : ""}
                  {photo.timeAgo}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="hidden rounded-full p-1.5 text-on-surface-variant transition hover:bg-surface-container-high md:inline-flex"
            >
              <MaterialIcon className="text-[22px]" name="close" />
            </button>
          </div>

          <div className="flex-1 space-y-4 p-4 md:overflow-y-auto">
            {photo.caption && (
              <p className="whitespace-pre-wrap break-words text-body-sm text-on-surface">{photo.caption}</p>
            )}

            <ReactionButtons
              reactions={photo.reactions}
              userReaction={photo.userReaction}
              disabled={reacting}
              onReact={handleReact}
            />

            <div className="flex flex-wrap items-center gap-2 border-b border-dusty-border/60 pb-3">
              <a
                href={photo.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-dusty-border px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant transition hover:text-primary"
              >
                <MaterialIcon className="text-[14px]" name="open_in_new" />
                Ảnh gốc
              </a>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onSetCover(photo)}
                  className="inline-flex items-center gap-1 rounded-lg border border-dusty-border px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant transition hover:text-primary"
                >
                  <MaterialIcon className="text-[14px]" name="wallpaper" />
                  Đặt làm ảnh bìa
                </button>
              )}
              {(canManage || isOwner) && (
                <button
                  type="button"
                  onClick={handleDeletePhoto}
                  disabled={deletingPhoto}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <MaterialIcon className="text-[14px]" name="delete_outline" />
                  {deletingPhoto ? "Đang xóa..." : "Xóa ảnh"}
                </button>
              )}
            </div>

            {notice && (
              <div
                className={`flex items-start justify-between gap-2 rounded-xl p-2.5 text-xs font-semibold ${
                  notice.type === "success"
                    ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border border-red-300 bg-red-50 text-red-900"
                }`}
              >
                <span>{notice.text}</span>
                <button type="button" onClick={() => setNotice(null)} aria-label="Đóng thông báo">
                  <MaterialIcon className="text-[14px]" name="close" />
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
                  <MaterialIcon className="text-[18px] text-primary" name="forum" />
                  Bình luận ({comments.length})
                </h3>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  +1đ / bình luận
                </span>
              </div>

              {loadingComments ? (
                <div className="space-y-2">
                  <div className="h-14 animate-pulse rounded-xl bg-surface-container/60" />
                  <div className="h-14 animate-pulse rounded-xl bg-surface-container/60" />
                </div>
              ) : comments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-dusty-border/80 p-4 text-center text-xs text-on-surface-variant">
                  Chưa có bình luận nào. Hãy là người đầu tiên!
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {rootComments.map((c) => {
                    const replies = comments.filter((r) => r.parentId === c.id);
                    const replying = replyTarget?.rootId === c.id;
                    return (
                      <li key={c.id} className="space-y-2">
                        {renderComment(c)}
                        {(replies.length > 0 || replying) && (
                          <div className="ml-4 space-y-2 border-l-2 border-dusty-border/70 pl-2.5">
                            {replies.map((r) => renderComment(r))}
                            {replying && (
                              <form onSubmit={handleSubmitReply} className="space-y-1.5">
                                <div className="flex items-end gap-2">
                                  <textarea
                                    autoFocus
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        e.stopPropagation();
                                        setReplyTarget(null);
                                      }
                                    }}
                                    rows={2}
                                    maxLength={1500}
                                    disabled={replySubmitting}
                                    placeholder={`Trả lời ${replyTarget.authorName}...`}
                                    className="flex-1 resize-none rounded-xl border border-dusty-border bg-white p-2 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:bg-surface-container sm:text-sm"
                                  />
                                  <div className="flex shrink-0 flex-col gap-1">
                                    <button
                                      type="submit"
                                      disabled={replySubmitting || !replyText.trim()}
                                      aria-label="Gửi phản hồi"
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-dusty-dark disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {replySubmitting ? (
                                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                      ) : (
                                        <MaterialIcon className="text-[16px]" name="send" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setReplyTarget(null)}
                                      aria-label="Hủy trả lời"
                                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-dusty-border text-on-surface-variant transition hover:bg-surface-container"
                                    >
                                      <MaterialIcon className="text-[16px]" name="close" />
                                    </button>
                                  </div>
                                </div>
                                {replyError && <p className="text-[11px] font-semibold text-red-700">{replyError}</p>}
                              </form>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmitComment} className="space-y-2 border-t border-dusty-border/70 p-4">
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
              {canManage ? (
                <span className="font-semibold text-amber-800">Quản trị viên (không giới hạn)</span>
              ) : isLimitReached ? (
                <span className="font-bold text-red-700">
                  Đã đạt tối đa {ALBUM_COMMENT_LIMIT}/{ALBUM_COMMENT_LIMIT} bình luận cho ảnh này
                </span>
              ) : (
                <span>
                  Đã bình luận{" "}
                  <strong className="text-primary">
                    {myCommentCount}/{ALBUM_COMMENT_LIMIT}
                  </strong>
                </span>
              )}
              <span>{content.length}/1500</span>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={2}
                maxLength={1500}
                disabled={submitting || isLimitReached}
                placeholder={
                  isLimitReached
                    ? "Bạn đã đủ 3 bình luận cho ảnh này."
                    : "Viết bình luận về ảnh... (+1đ thi đua)"
                }
                className="flex-1 resize-none rounded-xl border border-dusty-border bg-white p-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:bg-surface-container"
              />
              <button
                type="submit"
                disabled={submitting || isLimitReached || !content.trim()}
                aria-label="Gửi bình luận"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs transition hover:bg-dusty-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <MaterialIcon className="text-[20px]" name="send" />
                )}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
