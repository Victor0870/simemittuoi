"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/client";
import { CDILV_STORAGE } from "@/lib/supabase/tables";
import type { PostComment } from "@/lib/data/posts";

type PostCommentsSectionProps = {
  postId: string;
  postTitle?: string;
  initialCommentCount?: number;
  initialComments?: PostComment[];
};

/**
 * Trích xuất các URL ảnh trong nội dung bình luận để hiển thị ảnh trực quan
 */
function parseCommentContent(text: string): { cleanText: string; imageUrls: string[] } {
  // Nhận diện các link ảnh thông dụng hoặc link upload từ Supabase Storage
  const imgUrlRegex =
    /(https?:\/\/[^\s]+?\.(?:png|jpe?g|webp|gif|svg)(?:\?[^\s]*)?|https?:\/\/[^\s]+?\/storage\/v1\/object\/public\/[^\s]+)/gi;

  const matches = text.match(imgUrlRegex) || [];
  const imageUrls: string[] = [];
  matches.forEach((url) => {
    // Làm sạch dấu ngoặc hoặc dấu câu ở cuối nếu bị dính
    const cleanUrl = url.replace(/[),;.]+$/, "");
    if (!imageUrls.includes(cleanUrl)) {
      imageUrls.push(cleanUrl);
    }
  });

  // Loại bỏ các dòng gắn nhãn link ảnh thô để phần chữ hiển thị gãy gọn
  let cleanText = text;
  imageUrls.forEach((url) => {
    cleanText = cleanText
      .replace(new RegExp(`\\[?Ảnh[^\\]]*\\]?:?\\s*${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"), "")
      .replace(url, "")
      .trim();
  });

  return { cleanText, imageUrls };
}

export function PostCommentsSection({
  postId,
  postTitle,
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

  // Tải ảnh về & Sao chép link (Hỗ trợ Admin tạo bình chọn)
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

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

  // Comments submitted by the current user for this post
  const myComments = user ? comments.filter((c) => c.userId === user.id) : [];
  const myCommentCount = myComments.length;
  const isLimitReached = !isAdmin && myCommentCount >= 3;
  const remainingCount = Math.max(0, 3 - myCommentCount);

  // Danh sách toàn bộ tác phẩm logo được gửi qua bình luận (cho Admin tổng hợp và tải về)
  const allContestSubmissions = useMemo(() => {
    return comments.flatMap((c) => {
      const { imageUrls } = parseCommentContent(c.content);
      return imageUrls.map((url, idx) => ({
        url,
        authorName: c.authorName,
        authorDepartment: c.authorDepartment,
        authorCode: c.authorCode,
        commentId: c.id,
        index: idx + 1,
        filename: `Logo_CDILV_${(c.authorName || "tac_gia").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, "_")}_${c.id.slice(0, 6)}.png`,
      }));
    });
  }, [comments]);

  function clearNoticeAfterTimeout() {
    setTimeout(() => {
      setNotice(null);
    }, 5000);
  }

  // Tải một ảnh về máy
  async function handleDownloadImage(url: string, filename: string) {
    setDownloadingUrl(url);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Fetch failed");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingUrl(null);
    }
  }

  // Tải toàn bộ ảnh dự thi về máy (Admin)
  async function handleDownloadAll() {
    if (downloadingAll || allContestSubmissions.length === 0) return;
    setDownloadingAll(true);
    try {
      for (let i = 0; i < allContestSubmissions.length; i++) {
        const item = allContestSubmissions[i];
        await handleDownloadImage(item.url, item.filename);
        // Nghỉ 350ms giữa các lần tải để trình duyệt không chặn nhiều file tải xuống
        await new Promise((r) => setTimeout(r, 350));
      }
      setNotice({
        type: "success",
        text: `Đã hoàn tất tải ${allContestSubmissions.length} ảnh thiết kế Logo về máy!`,
      });
      clearNoticeAfterTimeout();
    } catch {
      setNotice({
        type: "error",
        text: "Có lỗi khi tải hàng loạt ảnh. Bạn có thể bấm nút Tải ảnh trên từng mẫu logo.",
      });
    } finally {
      setDownloadingAll(false);
    }
  }

  // Sao chép link ảnh vào clipboard
  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2500);
    } catch {
      // fallback
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user || !isApproved) {
      setNotice({
        type: "error",
        text: "Chỉ thành viên đã được duyệt mới có quyền tải ảnh tác phẩm.",
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
      const cleanFileName = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
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
        text: "Đã tải ảnh lên thành công! Hãy viết vài câu thuyết minh ý nghĩa Logo rồi gửi bình luận.",
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
        text: "Vui lòng nhập nội dung thuyết minh hoặc tải ảnh thiết kế logo.",
      });
      return;
    }

    // Ghép ảnh đính kèm vào nội dung
    const fullContent = attachedImageUrl
      ? trimmed
        ? `${trimmed}\n\n[Ảnh thiết kế Logo]: ${attachedImageUrl}`
        : `[Ảnh thiết kế Logo]: ${attachedImageUrl}`
      : trimmed;

    if (fullContent.length > 2000) {
      setNotice({
        type: "error",
        text: "Bình luận quá dài (tối đa 2000 ký tự).",
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
        body: JSON.stringify({ postId, content: fullContent }),
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
      setCommentCount((prev) => Math.max(0, prev - 1));
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
              Bình luận trao đổi & Tác phẩm dự thi
            </h2>
            <p className="text-body-xs sm:text-body-sm text-on-surface-variant">
              Giao lưu, đóng góp ý kiến, gửi ảnh thiết kế và nhận điểm thi đua
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-label-xs sm:text-label-sm font-bold text-amber-900 shadow-xs">
            <MaterialIcon className="text-[16px] text-amber-600" name="military_tech" />
            +1đ thi đua / bình luận
          </span>
          <span className="rounded-full bg-dusty-light px-3 py-1 text-label-xs sm:text-label-sm font-semibold text-primary">
            {commentCount} bình luận
          </span>
        </div>
      </div>

      {/* Rules Notice Pill */}
      <div className="flex items-start gap-2.5 rounded-xl border border-dusty-border/70 bg-gradient-to-r from-dusty-light/40 via-white to-white p-3 text-xs sm:text-body-sm text-on-surface-variant">
        <MaterialIcon className="shrink-0 text-[18px] text-primary" name="info" />
        <div className="leading-relaxed">
          <strong className="text-on-surface">Quy định bình luận: </strong>
          Đoàn viên được cộng <strong>+1 điểm thi đua</strong> cho mỗi bình luận. Giới hạn{" "}
          <strong>tối đa 3 bình luận</strong> cho mỗi đoàn viên trên một bài viết (cho phép gửi tối
          đa 3 mẫu thiết kế khác nhau). Quản trị viên không bị giới hạn.
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
            <strong className="font-bold text-primary">{commentCount} bình luận</strong> trao đổi.
            Vui lòng đăng ký hoặc đăng nhập tài khoản thành viên Đoàn cơ sở để được đọc toàn bộ bình
            luận, xem các tác phẩm thiết kế và tham gia đóng góp ý kiến.
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
                chấp hành xem xét phê duyệt. Sau khi được duyệt, bạn sẽ có thể xem toàn bộ bình luận,
                gửi mẫu thiết kế Logo và nhận điểm thi đua.
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-label-xs font-bold text-red-800">
                      <MaterialIcon className="text-[13px]" name="block" />
                      Đã đạt tối đa 3/3 bình luận
                    </span>
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

            {/* Form or Max Reached Banner */}
            {isLimitReached ? (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950">
                <MaterialIcon className="shrink-0 text-[24px] text-emerald-600" name="task_alt" />
                <div className="text-xs sm:text-body-sm">
                  <p className="font-bold">Bạn đã đăng đủ 3 bình luận cho bài viết này!</p>
                  <p className="text-emerald-800">
                    Toàn bộ điểm thi đua (+3đ) đã được ghi nhận. Cảm ơn sự tích cực đóng góp và chia
                    sẻ sáng tạo của bạn!
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Viết lời bình luận, ý kiến đóng góp hoặc thuyết minh ý nghĩa mẫu thiết kế Logo... (+1đ thi đua)"
                    rows={3}
                    maxLength={1500}
                    disabled={submitting || uploadingImage}
                    className="w-full rounded-2xl border border-dusty-border bg-white p-3.5 sm:p-4 text-body-sm sm:text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-surface-container"
                  />
                  <div className="absolute bottom-3 right-3 text-[11px] text-on-surface-variant">
                    {content.length}/1500
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
                      <p className="font-bold text-on-surface">Đã đính kèm ảnh thiết kế Logo</p>
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
                    {/* Nút đính kèm ảnh Logo */}
                    <button
                      type="button"
                      disabled={uploadingImage || submitting}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-dusty-border bg-white px-3.5 py-2 text-xs sm:text-label-sm font-semibold text-on-surface transition hover:bg-dusty-light disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <span>Đang tải ảnh...</span>
                        </>
                      ) : (
                        <>
                          <MaterialIcon className="text-[18px] text-primary" name="add_photo_alternate" />
                          <span>Đính kèm ảnh Logo</span>
                        </>
                      )}
                    </button>

                    <span className="text-xs text-on-surface-variant hidden sm:inline">
                      Mỗi bình luận tích lũy ngay <strong>+1 điểm thi đua</strong>
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || uploadingImage || (!content.trim() && !attachedImageUrl)}
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

          {/* ADMIN TOOLBAR: TỔNG HỢP & TẢI TOÀN BỘ ẢNH THIẾT KẾ ĐỂ TẠO BÌNH CHỌN */}
          {isAdmin && allContestSubmissions.length > 0 && (
            <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/[0.04] to-white p-4 sm:p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
                    <MaterialIcon className="text-[24px]" name="palette" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-body-md sm:text-title-sm font-bold text-on-surface">
                        Quản trị: Tác phẩm thiết kế Logo ({allContestSubmissions.length} ảnh dự thi)
                      </h4>
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                        Quyền Admin
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Tải tất cả các mẫu logo về máy hoặc lấy link ảnh trực tiếp để tạo danh sách
                      bình chọn trong trang Quản lý Vote.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    disabled={downloadingAll}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs sm:text-label-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:opacity-50"
                  >
                    {downloadingAll ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Đang tải...</span>
                      </>
                    ) : (
                      <>
                        <MaterialIcon className="text-[17px]" name="cloud_download" />
                        <span>Tải toàn bộ ({allContestSubmissions.length} ảnh)</span>
                      </>
                    )}
                  </button>

                  <Link
                    href="/admin/polls"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary bg-white px-3.5 py-2 text-xs sm:text-label-sm font-bold text-primary transition hover:bg-primary/5"
                  >
                    <MaterialIcon className="text-[17px]" name="how_to_vote" />
                    <span>Tạo cuộc bình chọn</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

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
                  Chưa có bình luận hoặc tác phẩm nào cho bài viết này.
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant/70">
                  Hãy là người đầu tiên gửi ý kiến đóng góp hoặc gửi tác phẩm thiết kế Logo dự thi!
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {comments.map((comment) => {
                  const isAuthor = user && user.id === comment.userId;
                  const canDelete = isAdmin || isAuthor;
                  const isCommentAdmin = comment.authorRole === "admin";
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

                        {/* Danh sách ảnh đính kèm (Logo tác phẩm) */}
                        {parsed.imageUrls.length > 0 && (
                          <div className="flex flex-wrap gap-3.5 pt-1">
                            {parsed.imageUrls.map((imgUrl, idx) => {
                              const authorClean = (comment.authorName || "tac_gia").replace(
                                /[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g,
                                "_",
                              );
                              const downloadFilename = `Logo_CDILV_${authorClean}_${comment.id.slice(0, 6)}${idx > 0 ? `_${idx + 1}` : ""}.png`;

                              return (
                                <div
                                  key={idx}
                                  className="group/img relative inline-block max-w-full overflow-hidden rounded-2xl border border-dusty-border bg-slate-50/80 shadow-xs"
                                >
                                  {/* Thanh công cụ ảnh: Tải về & Copy link & Xem ảnh gốc */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dusty-border/60 bg-white px-3 py-2 text-xs font-semibold text-on-surface-variant">
                                    <div className="flex items-center gap-1.5 text-primary">
                                      <MaterialIcon className="text-[16px]" name="palette" />
                                      <span className="font-bold">Mẫu thiết kế Logo</span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {/* Nút Tải ảnh về máy (Download button) */}
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadImage(imgUrl, downloadFilename)}
                                        disabled={downloadingUrl === imgUrl}
                                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition hover:bg-dusty-dark disabled:opacity-50"
                                        title="Tải ảnh về máy để tạo cuộc bình chọn"
                                      >
                                        {downloadingUrl === imgUrl ? (
                                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        ) : (
                                          <MaterialIcon className="text-[14px]" name="download" />
                                        )}
                                        <span>Tải ảnh</span>
                                      </button>

                                      {/* Nút Copy link ảnh (rất tiện khi Admin dán vào Poll Option) */}
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => handleCopyLink(imgUrl)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-dusty-border bg-dusty-light/60 px-2 py-1 text-[11px] font-semibold text-primary transition hover:bg-dusty-light"
                                          title="Sao chép link ảnh trực tiếp để tạo ứng viên Bình chọn"
                                        >
                                          <MaterialIcon
                                            className="text-[14px]"
                                            name={copiedUrl === imgUrl ? "done" : "content_copy"}
                                          />
                                          <span>{copiedUrl === imgUrl ? "Đã chép link" : "Copy link"}</span>
                                        </button>
                                      )}

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
                                      alt={`Mẫu thiết kế Logo từ ${comment.authorName}`}
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
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
