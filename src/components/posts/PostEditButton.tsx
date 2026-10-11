"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";

type PostEditButtonProps = {
  post: {
    id: string;
    title: string;
    content: string;
    tag: string;
    tagTone?: string;
    isImportant?: boolean;
  };
};

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
  const { isAdmin } = useAuth();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [tag, setTag] = useState(post.tag || "Thông báo");
  const [isImportant, setIsImportant] = useState(Boolean(post.isImportant));
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAdmin) return null;

  function handleOpen() {
    setTitle(post.title);
    setContent(post.content);
    setTag(post.tag || "Thông báo");
    setIsImportant(Boolean(post.isImportant));
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

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/posts/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          title: title.trim(),
          content: content.trim(),
          tag: tag.trim() || "Thông báo",
          tagTone: isImportant ? "error" : tag.trim() === "Khẩn cấp" ? "error" : "primary",
          isImportant,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Không thể cập nhật bài viết.");
        return;
      }

      setIsOpen(false);
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
      <button
        onClick={handleOpen}
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 transition-all active:scale-95 cursor-pointer"
        title="Quản trị viên: Chỉnh sửa bài viết này"
      >
        <MaterialIcon className="text-[16px] text-amber-700" name="edit_note" />
        <span>Sửa bài viết</span>
      </button>

      {/* MODAL CHỈNH SỬA BÀI VIẾT */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-dusty-border bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-amber-50/50 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <MaterialIcon className="text-[20px]" name="edit_document" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#173A67]">
                    Chỉnh sửa bài viết
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cập nhật tiêu đề, phân loại và nội dung bài viết
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
            <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-6 space-y-4">
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
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold text-slate-800 focus:border-[#173A67] focus:outline-hidden focus:ring-2 focus:ring-[#173A67]/20"
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
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-700 focus:border-[#173A67] focus:outline-hidden"
                />
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
                  rows={14}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập nội dung bài viết..."
                  className="w-full rounded-xl border border-slate-300 p-3.5 text-sm leading-relaxed text-slate-800 font-sans focus:border-[#173A67] focus:outline-hidden focus:ring-2 focus:ring-[#173A67]/20 resize-y"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
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
                      <MaterialIcon className="text-[16px]" name="save" />
                      <span>Lưu thay đổi</span>
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
