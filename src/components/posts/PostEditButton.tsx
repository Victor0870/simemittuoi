"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { uploadPostImage } from "@/lib/post-image-upload";
import { POST_IMAGE_ACCEPT, postInlineImageMarkup } from "@/lib/post-images";
import { GUIDE_POST_CATEGORY } from "@/lib/post-categories";
import { isScheduledAt, toDateTimeLocalValue } from "@/lib/post-schedule";

type PostEditButtonProps = {
  /** Không truyền = nút "Đăng bài mới". */
  post?: {
    id: string;
    title: string;
    content: string;
    tag: string;
    tagTone?: string;
    isImportant?: boolean;
    isActive?: boolean;
    isContest?: boolean;
    contestPrompt?: string | null;
    publishedAt?: string;
    imageUrl?: string | null;
  };
  /** Tag mặc định khi đăng bài mới (vd. đăng từ trang /huong-dan). */
  defaultTag?: string;
  /** Nhãn nút đăng bài mới (mặc định "Đăng bài mới"). */
  createLabel?: string;
  /** Nút sửa dạng icon gọn (dùng trong bảng quản trị). */
  compact?: boolean;
  /** Mở sẵn form khi vào trang (link ?edit= / ?new= từ nút tắt trên trang công khai). */
  autoOpen?: boolean;
};

function defaultScheduleValue(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toDateTimeLocalValue(d);
}

const SUGGESTED_TAGS = [
  "Cuộc thi",
  "Thể thao",
  "Sự kiện",
  "Thông báo",
  "Thông báo quan trọng",
  "Khẩn cấp",
  "Thi đua",
  GUIDE_POST_CATEGORY.tag,
];

export function PostEditButton({
  post,
  defaultTag,
  createLabel = "Đăng bài mới",
  compact = false,
  autoOpen = false,
}: PostEditButtonProps) {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.postsManage);
  const autoOpenedRef = useRef(false);
  const router = useRouter();
  const isCreate = !post;
  const wasScheduled = post?.publishedAt ? isScheduledAt(post.publishedAt) : false;

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [tag, setTag] = useState(post?.tag || defaultTag || "Thông báo");
  const [isImportant, setIsImportant] = useState(Boolean(post?.isImportant));
  const [isActive, setIsActive] = useState(post?.isActive !== false);
  const [isContest, setIsContest] = useState(Boolean(post?.isContest));
  const [contestPrompt, setContestPrompt] = useState(post?.contestPrompt ?? "");
  const [scheduleEnabled, setScheduleEnabled] = useState(wasScheduled);
  const [scheduleValue, setScheduleValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(post?.imageUrl ?? null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [inlineUploading, setInlineUploading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const uploading = coverUploading || inlineUploading;

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!autoOpen || !canManage || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    handleOpen();
    // Bỏ ?edit= / ?new= để tải lại trang không tự mở form lần nữa
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, canManage]);

  if (!canManage) return null;

  function handleOpen() {
    setTitle(post?.title ?? "");
    setContent(post?.content ?? "");
    setTag(post?.tag || defaultTag || "Thông báo");
    setIsImportant(Boolean(post?.isImportant));
    setIsActive(post?.isActive !== false);
    setIsContest(Boolean(post?.isContest));
    setContestPrompt(post?.contestPrompt ?? "");
    setScheduleEnabled(wasScheduled);
    setScheduleValue(
      wasScheduled && post?.publishedAt
        ? toDateTimeLocalValue(post.publishedAt)
        : defaultScheduleValue(),
    );
    setErrorMsg(null);
    setCoverUrl(post?.imageUrl ?? null);
    setCoverError(null);
    setInlineError(null);
    setIsOpen(true);
  }

  async function handleCoverPicked(file: File | undefined) {
    if (!file) return;
    setCoverUploading(true);
    setCoverError(null);
    try {
      setCoverUrl(await uploadPostImage(file));
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "Không tải được ảnh lên.");
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  function handleInlineClick() {
    const textarea = contentRef.current;
    selectionRef.current = textarea
      ? { start: textarea.selectionStart, end: textarea.selectionEnd }
      : null;
    inlineInputRef.current?.click();
  }

  async function handleInlinePicked(file: File | undefined) {
    if (!file) return;
    setInlineUploading(true);
    setInlineError(null);
    try {
      const url = await uploadPostImage(file);
      const markup = postInlineImageMarkup(url);
      const sel = selectionRef.current;
      let cursor = 0;
      setContent((prev) => {
        const start = Math.min(sel?.start ?? prev.length, prev.length);
        const end = Math.min(Math.max(sel?.end ?? prev.length, start), prev.length);
        const before = prev.slice(0, start);
        const after = prev.slice(end);
        const insert = `${before && !before.endsWith("\n") ? "\n" : ""}${markup}${after.startsWith("\n") ? "" : "\n"}`;
        cursor = before.length + insert.length;
        return before + insert + after;
      });
      requestAnimationFrame(() => {
        const textarea = contentRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      });
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Không tải được ảnh lên.");
    } finally {
      setInlineUploading(false);
      if (inlineInputRef.current) inlineInputRef.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving || uploading) return;

    if (!title.trim()) {
      setErrorMsg("Vui lòng nhập tiêu đề bài viết.");
      return;
    }

    if (!content.trim()) {
      setErrorMsg("Vui lòng nhập nội dung bài viết.");
      return;
    }

    let scheduledAt: string | null | undefined;
    if (scheduleEnabled) {
      const scheduleDate = new Date(scheduleValue);
      if (!scheduleValue || Number.isNaN(scheduleDate.getTime())) {
        setErrorMsg("Vui lòng chọn ngày giờ đăng bài.");
        return;
      }
      if (scheduleDate.getTime() <= Date.now()) {
        setErrorMsg("Thời điểm hẹn giờ phải ở tương lai.");
        return;
      }
      scheduledAt = scheduleDate.toISOString();
    } else if (wasScheduled) {
      scheduledAt = null;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch(isCreate ? "/api/posts/create" : "/api/posts/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post?.id,
          title: title.trim(),
          content: content.trim(),
          tag: tag.trim() || "Thông báo",
          tagTone: isImportant ? "error" : tag.trim() === "Khẩn cấp" ? "error" : "primary",
          isImportant,
          isActive,
          isContest,
          contestPrompt: isContest ? contestPrompt.trim() || null : null,
          scheduledAt,
          imageUrl: isCreate || coverUrl !== (post?.imageUrl ?? null) ? coverUrl : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || (isCreate ? "Không thể đăng bài viết." : "Không thể cập nhật bài viết."));
        return;
      }

      setIsOpen(false);
      if (isCreate && data.id) {
        router.push(`/posts/${data.id}`);
        return;
      }
      router.refresh();
      // Reload nhẹ để bảo đảm text được update hoàn toàn
      window.location.reload();
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi kết nối máy chủ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {isCreate ? (
        <button
          onClick={handleOpen}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#1E4A7D] active:scale-95 cursor-pointer sm:text-label-md"
        >
          <MaterialIcon className="text-[18px]" name="post_add" />
          <span>{createLabel}</span>
        </button>
      ) : compact ? (
        <button
          onClick={handleOpen}
          type="button"
          aria-label="Sửa bài viết"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#173A67] text-white shadow-2xs transition hover:bg-[#27496D] cursor-pointer"
          title="Sửa bài viết"
        >
          <MaterialIcon className="text-[18px]" name="edit" />
        </button>
      ) : (
        <button
          onClick={handleOpen}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 transition-all active:scale-95 cursor-pointer"
          title="Chỉnh sửa bài viết này"
        >
          <MaterialIcon className="text-[16px] text-amber-700" name="edit_note" />
          <span>Sửa bài viết</span>
        </button>
      )}

      {/* MODAL CHỈNH SỬA BÀI VIẾT */}
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-2 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col rounded-2xl border border-dusty-border bg-white shadow-2xl overflow-hidden sm:max-h-[90vh] sm:rounded-3xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-amber-50/50 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <MaterialIcon className="text-[20px]" name="edit_document" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#173A67]">
                    {isCreate ? "Đăng bài viết mới" : "Chỉnh sửa bài viết"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isCreate
                      ? "Nhập tiêu đề, phân loại và nội dung bài viết"
                      : "Cập nhật tiêu đề, phân loại và nội dung bài viết"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
              >
                <MaterialIcon className="text-[20px]" name="close" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
                {errorMsg && (
                  <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                    {errorMsg}
                  </div>
                )}

                {/* 1. Tiêu đề bài viết */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tiêu đề bài viết <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tiêu đề bài viết..."
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-base font-semibold text-slate-800 focus:border-[#173A67] focus:outline-hidden focus:ring-2 focus:ring-[#173A67]/20 sm:text-sm"
                  />
                </div>

                {/* Ảnh đại diện */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ảnh đại diện <span className="font-normal text-slate-400">(không bắt buộc)</span>
                  </label>
                  <input
                    ref={coverInputRef}
                    accept={POST_IMAGE_ACCEPT}
                    className="hidden"
                    type="file"
                    onChange={(e) => void handleCoverPicked(e.target.files?.[0])}
                  />
                  {coverUrl ? (
                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="Ảnh đại diện bài viết"
                        className="aspect-[16/9] w-full shrink-0 rounded-xl border border-slate-200 bg-white object-cover sm:w-48"
                        src={coverUrl}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={coverUploading}
                          onClick={() => coverInputRef.current?.click()}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-[#173A67] hover:border-[#173A67] disabled:opacity-50 cursor-pointer"
                        >
                          <MaterialIcon
                            className={`text-[16px] ${coverUploading ? "animate-spin" : ""}`}
                            name={coverUploading ? "progress_activity" : "swap_horiz"}
                          />
                          {coverUploading ? "Đang tải ảnh..." : "Đổi ảnh khác"}
                        </button>
                        <button
                          type="button"
                          disabled={coverUploading}
                          onClick={() => {
                            setCoverUrl(null);
                            setCoverError(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                        >
                          <MaterialIcon className="text-[16px]" name="delete" />
                          Xóa ảnh
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={coverUploading}
                      onClick={() => coverInputRef.current?.click()}
                      className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 py-5 text-slate-500 transition hover:border-[#173A67]/50 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                    >
                      <MaterialIcon
                        className={`text-[30px] text-[#173A67] ${coverUploading ? "animate-spin" : ""}`}
                        name={coverUploading ? "progress_activity" : "add_photo_alternate"}
                      />
                      <span className="text-sm font-bold text-slate-700">
                        {coverUploading ? "Đang tải ảnh..." : "Chọn ảnh đại diện"}
                      </span>
                      <span className="text-[11px]">JPG, PNG, WEBP, GIF · tối đa 5MB · ảnh lớn được tự nén</span>
                    </button>
                  )}
                  {coverError && (
                    <p className="mt-1.5 text-[11px] font-semibold text-red-700">{coverError}</p>
                  )}
                </div>

                {/* 2. Thẻ / Phân loại */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chủ đề / Phân loại (Tag)
                  </label>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {SUGGESTED_TAGS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTag(t)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          tag === t
                            ? "bg-[#173A67] text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder="Hoặc tự nhập tên tag..."
                    className="w-full rounded-xl border border-slate-300 p-2 text-base text-slate-700 focus:border-[#173A67] focus:outline-hidden sm:text-xs"
                  />
                </div>

                <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#173A67] focus:ring-[#173A67] cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                      <MaterialIcon className="text-[16px] text-[#173A67]" name="visibility" />
                      <span>Active — hiện bài cho mọi người</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                      Bỏ chọn để giữ Inactive (nháp). Bài Inactive chỉ người quản lý bài viết xem và sửa được.
                    </p>
                  </div>
                </label>

                <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={scheduleEnabled}
                      onChange={(e) => setScheduleEnabled(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-sky-950">
                        <MaterialIcon className="text-[16px] text-sky-700" name="schedule_send" />
                        <span>Hẹn giờ đăng bài</span>
                      </div>
                      <p className="text-[11px] text-sky-900/80 leading-normal mt-0.5">
                        {wasScheduled && !scheduleEnabled
                          ? "Bỏ hẹn giờ: bài sẽ được đăng ngay khi lưu."
                          : "Đến giờ đã chọn, bài tự hiện với đoàn viên và gửi thông báo. Trước đó chỉ người quản lý bài viết xem được."}
                      </p>
                    </div>
                  </label>
                  {scheduleEnabled && (
                    <div className="mt-2.5 space-y-1.5 pl-7">
                      <input
                        type="datetime-local"
                        required
                        step={60}
                        min={toDateTimeLocalValue(new Date())}
                        value={scheduleValue}
                        onChange={(e) => setScheduleValue(e.target.value)}
                        className="w-full rounded-xl border border-sky-300 bg-white p-2 text-base text-slate-800 focus:border-sky-600 focus:outline-hidden focus:ring-2 focus:ring-sky-600/20 sm:w-auto sm:text-sm"
                      />
                      {!isCreate && !wasScheduled && (
                        <p className="text-[11px] text-sky-900/80">
                          Bài đang hiển thị sẽ tạm ẩn cho đến giờ hẹn.
                        </p>
                      )}
                      {!isActive && (
                        <p className="text-[11px] font-semibold text-amber-800">
                          Bài đang Inactive: phải bật Active thì đến giờ bài mới được đăng.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Checkbox: Thông báo quan trọng */}
                <label className="flex items-start gap-3 p-3 rounded-2xl border border-amber-200 bg-amber-50/70 cursor-pointer hover:bg-amber-100/60 transition select-none">
                  <input
                    type="checkbox"
                    checked={isImportant}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsImportant(checked);
                      if (checked && tag === "Thông báo") {
                        setTag("Thông báo quan trọng");
                      }
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950">
                      <MaterialIcon className="text-[16px] text-amber-700" name="campaign" />
                      <span>Đánh dấu là Thông báo quan trọng</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 leading-normal mt-0.5">
                      Bài viết sẽ xuất hiện ở khối <strong>&ldquo;Thông báo quan trọng&rdquo;</strong> trên trang chủ. Nếu không chọn, bài viết sẽ hiển thị ở mục Tin tức thường.
                    </p>
                  </div>
                </label>

                {/* Checkbox: Bài viết cuộc thi (nhận bài thi qua bình luận) */}
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isContest}
                      onChange={(e) => setIsContest(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-950">
                        <MaterialIcon className="text-[16px] text-indigo-700" name="emoji_events" />
                        <span>Bài viết cuộc thi (nhận bài dự thi / thiết kế qua bình luận)</span>
                      </div>
                      <p className="text-[11px] text-indigo-900/80 leading-normal mt-0.5">
                        Bật tùy chọn này nếu bài viết là cuộc thi thu nhận tác phẩm qua mục bình luận (hiển thị giao diện nộp tác phẩm và thanh công cụ tổng hợp cho Quản trị viên). Mặc định tắt cho bài viết thường.
                      </p>
                    </div>
                  </label>
                  {isContest && (
                    <div className="mt-2.5 space-y-1 pl-7">
                      <label className="block text-[11px] font-bold text-indigo-950">
                        Gợi ý khung nhập bình luận / nộp bài dự thi (tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={contestPrompt}
                        onChange={(e) => setContestPrompt(e.target.value)}
                        placeholder="Viết lời bình luận, ý kiến đóng góp hoặc thuyết minh ý nghĩa mẫu thiết kế Logo... (+1đ thi đua)"
                        className="w-full rounded-xl border border-indigo-300 bg-white p-2 text-xs text-slate-800 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Nội dung bài viết */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Nội dung bài viết <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        {content.length} ký tự
                      </span>
                      <input
                        ref={inlineInputRef}
                        accept={POST_IMAGE_ACCEPT}
                        className="hidden"
                        type="file"
                        onChange={(e) => void handleInlinePicked(e.target.files?.[0])}
                      />
                      <button
                        type="button"
                        disabled={inlineUploading}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleInlineClick}
                        title="Tải ảnh lên và chèn vào vị trí con trỏ trong nội dung"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-[#173A67] hover:border-[#173A67] disabled:opacity-60 cursor-pointer"
                      >
                        <MaterialIcon
                          className={`text-[15px] ${inlineUploading ? "animate-spin" : ""}`}
                          name={inlineUploading ? "progress_activity" : "image"}
                        />
                        {inlineUploading ? "Đang tải ảnh..." : "Chèn ảnh"}
                      </button>
                    </div>
                  </div>
                  {inlineError && (
                    <p className="mb-1.5 text-[11px] font-semibold text-red-700">{inlineError}</p>
                  )}
                  <textarea
                    ref={contentRef}
                    required
                    rows={12}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Nhập nội dung bài viết..."
                    className="w-full rounded-xl border border-slate-300 p-3.5 text-base leading-relaxed text-slate-800 font-sans focus:border-[#173A67] focus:outline-hidden focus:ring-2 focus:ring-[#173A67]/20 resize-y sm:text-sm"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    In đậm: đặt chữ giữa hai cặp dấu sao, ví dụ <code className="rounded bg-slate-100 px-1">**Giai đoạn 1**</code>.
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Chèn ảnh: đặt con trỏ ở chỗ muốn chèn rồi bấm <strong>Chèn ảnh</strong>; ảnh hiện thành dòng{" "}
                    <code className="rounded bg-slate-100 px-1">![Ảnh](đường dẫn)</code>. Có thể sửa chữ mô tả trong ngoặc vuông, không sửa đường dẫn.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading || !title.trim() || !content.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1E4A7D] active:scale-95 disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? (
                    <>
                      <MaterialIcon className="animate-spin text-[16px]" name="progress_activity" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <MaterialIcon
                        className="text-[16px]"
                        name={!isCreate ? "save" : scheduleEnabled ? "schedule_send" : "send"}
                      />
                      <span>
                        {!isCreate ? "Lưu thay đổi" : scheduleEnabled ? "Hẹn giờ đăng" : "Đăng bài"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
