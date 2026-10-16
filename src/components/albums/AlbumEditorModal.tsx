"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { AlbumSummary } from "@/lib/data/albums";

type AlbumEditorModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  album?: AlbumSummary | null;
  onClose: () => void;
  onSaved: (albumId: string) => void;
};

const inputClass =
  "w-full rounded-xl border border-dusty-border px-3.5 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function AlbumEditorModal({ isOpen, mode, album, onClose, onSaved }: AlbumEditorModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allowMemberUpload, setAllowMemberUpload] = useState(true);
  const [maxPhotosPerMember, setMaxPhotosPerMember] = useState(5);
  const [awardPoints, setAwardPoints] = useState(false);
  const [uploadPoints, setUploadPoints] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && album) {
      setTitle(album.title);
      setDescription(album.description ?? "");
      setAllowMemberUpload(album.allowMemberUpload);
      setMaxPhotosPerMember(album.maxPhotosPerMember);
      setAwardPoints(album.uploadPoints > 0);
      setUploadPoints(album.uploadPoints > 0 ? album.uploadPoints : 1);
      setIsActive(album.isActive);
    } else {
      setTitle("");
      setDescription("");
      setAllowMemberUpload(true);
      setMaxPhotosPerMember(5);
      setAwardPoints(false);
      setUploadPoints(1);
      setIsActive(true);
    }
    setErrorMessage(null);
  }, [isOpen, mode, album]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!title.trim()) {
      setErrorMessage("Vui lòng nhập tên album.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/albums", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: album?.id,
          title: title.trim(),
          description: description.trim(),
          allowMemberUpload,
          maxPhotosPerMember,
          uploadPoints: allowMemberUpload && awardPoints ? uploadPoints : 0,
          isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu album.");

      onSaved(data.id ?? album?.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Đã xảy ra lỗi khi lưu album.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs animate-in fade-in duration-200 sm:p-5">
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-dusty-border bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-dusty-border/70 bg-gradient-to-r from-dusty-light/60 to-white px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <MaterialIcon className="text-[22px]" name="create_new_folder" />
            </div>
            <div>
              <h2 className="text-title-md font-bold text-on-surface sm:text-title-lg">
                {mode === "create" ? "Tạo album ảnh mới" : "Cài đặt album"}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Quyền đăng ảnh, giới hạn số ảnh và điểm thưởng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-on-surface-variant transition hover:bg-surface-container-high"
            aria-label="Đóng"
          >
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {errorMessage && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-900 sm:text-sm">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface sm:text-sm">
              Tên album <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Hội thao CDILV 2026, Du lịch hè, Ngày Phụ nữ Việt Nam 20/10..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface sm:text-sm">Mô tả</label>
            <textarea
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Giới thiệu ngắn về album, chủ đề ảnh mong muốn..."
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-on-surface sm:text-sm">Ai được đăng ảnh?</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAllowMemberUpload(true)}
                className={`flex items-start gap-2.5 rounded-2xl border-2 p-3 text-left transition ${
                  allowMemberUpload
                    ? "border-primary bg-primary/5"
                    : "border-dusty-border hover:border-primary/40"
                }`}
              >
                <MaterialIcon
                  className={`text-[22px] ${allowMemberUpload ? "text-primary" : "text-on-surface-variant"}`}
                  name="groups"
                />
                <span>
                  <span className="block text-sm font-bold text-on-surface">Thành viên được đăng</span>
                  <span className="block text-[11px] text-on-surface-variant">
                    Mọi đoàn viên đã duyệt cùng góp ảnh
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAllowMemberUpload(false)}
                className={`flex items-start gap-2.5 rounded-2xl border-2 p-3 text-left transition ${
                  !allowMemberUpload
                    ? "border-primary bg-primary/5"
                    : "border-dusty-border hover:border-primary/40"
                }`}
              >
                <MaterialIcon
                  className={`text-[22px] ${!allowMemberUpload ? "text-primary" : "text-on-surface-variant"}`}
                  name="shield_person"
                />
                <span>
                  <span className="block text-sm font-bold text-on-surface">Chỉ Admin đăng</span>
                  <span className="block text-[11px] text-on-surface-variant">
                    Thành viên chỉ xem, thả cảm xúc và bình luận
                  </span>
                </span>
              </button>
            </div>
          </div>

          {allowMemberUpload && (
            <div className="space-y-4 rounded-2xl border border-dusty-border/80 bg-dusty-light/30 p-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface sm:text-sm">
                  Giới hạn số ảnh mỗi thành viên
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={maxPhotosPerMember}
                    onChange={(e) =>
                      setMaxPhotosPerMember(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))
                    }
                    className={`${inputClass} pr-24`}
                  />
                  <span className="absolute top-2.5 right-3 text-xs font-bold text-on-surface-variant">
                    ảnh / người
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={awardPoints}
                    onChange={(e) => setAwardPoints(e.target.checked)}
                    className="h-4 w-4 accent-[#173A67]"
                  />
                  <span className="text-xs font-bold text-on-surface sm:text-sm">
                    Cộng điểm thi đua khi đăng ảnh
                  </span>
                </label>

                {awardPoints && (
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={uploadPoints}
                      onChange={(e) =>
                        setUploadPoints(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))
                      }
                      className={`${inputClass} pr-24`}
                    />
                    <span className="absolute top-2.5 right-3 text-xs font-bold text-amber-700">
                      điểm / ảnh
                    </span>
                    <p className="mt-1.5 text-[11px] text-on-surface-variant">
                      Tối đa {maxPhotosPerMember} ảnh đầu tiên của mỗi người được cộng điểm (tối đa{" "}
                      <strong>{maxPhotosPerMember * uploadPoints} điểm</strong>/người). Xóa ảnh sẽ thu hồi điểm.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "edit" && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-dusty-border/80 p-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-[#173A67]"
              />
              <span>
                <span className="block text-sm font-bold text-on-surface">Hiển thị album với thành viên</span>
                <span className="block text-[11px] text-on-surface-variant">
                  Bỏ chọn để tạm ẩn album (chỉ Admin còn thấy)
                </span>
              </span>
            </label>
          )}

          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            Mỗi bình luận về ảnh được <strong>+1 điểm</strong> thi đua, tối đa 3 bình luận / ảnh / thành viên
            (giống quy định bình luận bài viết).
          </p>

          <div className="flex items-center justify-end gap-3 border-t border-dusty-border/70 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-dusty-border px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-dusty-light/50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <MaterialIcon className="text-[18px]" name="check" />
                  <span>{mode === "create" ? "Tạo album" : "Lưu cài đặt"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
