"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";
import { PERMISSIONS } from "@/lib/auth/permissions";
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
    publishedAt?: string;
  };
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
];

export function PostEditButton({ post }: PostEditButtonProps) {
  const { can } = useAuth();
  const router = useRouter();
  const isCreate = !post;
  const wasScheduled = post?.publishedAt ? isScheduledAt(post.publishedAt) : false;

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [tag, setTag] = useState(post?.tag || "Thông báo");
  const [isImportant, setIsImportant] = useState(Boolean(post?.isImportant));
  const [isActive, setIsActive] = useState(post?.isActive !== false);
  const [scheduleEnabled, setScheduleEnabled] = useState(wasScheduled);
  const [scheduleValue, setScheduleValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!can(PERMISSIONS.postsManage)) return null;

  function handleOpen() {
    setTitle(post?.title ?? "");
    setContent(post?.content ?? "");
    setTag(post?.tag || "Thông báo");
    setIsImportant(Boolean(post?.isImportant));
    setIsActive(post?.isActive !== false);
    setScheduleEnabled(wasScheduled);
    setScheduleValue(
      wasScheduled && post?.publishedAt
        ? toDateTimeLocalValue(post.publishedAt)
        : defaultScheduleValue(),
    );
    setErrorMsg(null);
    setIsOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

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
          scheduledAt,
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
          <span>Đăng bài mới</span>
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

                {/* 3. Nội dung bài viết */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Nội dung bài viết <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {content.length} ký tự
                    </span>
                  </div>
                  <textarea
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
                  disabled={saving || !title.trim() || !content.trim()}
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
