"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { resizeImageFile } from "@/lib/image-resize";
import type { Activity } from "@/lib/mock-data";
import { isScheduledAt, toDateTimeLocalValue } from "@/lib/post-schedule";

function defaultScheduleValue(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toDateTimeLocalValue(d);
}

type ActivityEditorModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  initialActivity?: Activity | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export function ActivityEditorModal({
  isOpen,
  mode,
  initialActivity,
  onClose,
  onSuccess,
}: ActivityEditorModalProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [points, setPoints] = useState<number>(100);
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");
  const wasScheduled =
    mode === "edit" && initialActivity?.publishedAt ? isScheduledAt(initialActivity.publishedAt) : false;

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Sync form when modal opens or initialActivity changes
  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialActivity) {
      setTitle(initialActivity.title || "");
      setPoints(initialActivity.points ?? 100);
      setLocation(initialActivity.location || "");
      setDescription(initialActivity.description || "");
      setImageUrl(initialActivity.imageUrl || null);
      setIsRegistrationOpen(initialActivity.isRegistrationOpen !== false);
      setIsActive(initialActivity.isActive !== false);
      const scheduled = initialActivity.publishedAt ? isScheduledAt(initialActivity.publishedAt) : false;
      setScheduleEnabled(scheduled);
      setScheduleValue(
        scheduled && initialActivity.publishedAt
          ? toDateTimeLocalValue(initialActivity.publishedAt)
          : defaultScheduleValue(),
      );

      // Extract date YYYY-MM-DD if available
      if (initialActivity.date) {
        // Check if date is already YYYY-MM-DD or DD/MM/YYYY
        if (initialActivity.date.includes("/")) {
          const parts = initialActivity.date.split("/");
          if (parts.length === 3) {
            setEventDate(`${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`);
          } else {
            setEventDate("");
          }
        } else {
          setEventDate(initialActivity.date);
        }
      } else {
        setEventDate("");
      }
    } else {
      // Create mode default values
      setTitle("");
      setPoints(100);
      setEventDate(new Date().toISOString().split("T")[0]);
      setLocation("");
      setDescription("");
      setImageUrl(null);
      setIsRegistrationOpen(true);
      setIsActive(true);
      setScheduleEnabled(false);
      setScheduleValue(defaultScheduleValue());
    }

    setErrorMessage(null);
  }, [isOpen, mode, initialActivity]);

  if (!isOpen) return null;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setErrorMessage(null);

    try {
      const resizedBase64 = await resizeImageFile(file, 1200, 800, 0.8);
      setImageUrl(resizedBase64);
    } catch {
      setErrorMessage("Không thể nén ảnh. Vui lòng thử lại với ảnh khác.");
    } finally {
      setIsCompressing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage("Vui lòng nhập tên hoạt động.");
      return;
    }

    let scheduledAt: string | null | undefined;
    if (scheduleEnabled) {
      const scheduleDate = new Date(scheduleValue);
      if (!scheduleValue || Number.isNaN(scheduleDate.getTime())) {
        setErrorMessage("Vui lòng chọn ngày giờ hiển thị hoạt động.");
        return;
      }
      if (scheduleDate.getTime() <= Date.now()) {
        setErrorMessage("Thời điểm hẹn giờ phải ở tương lai.");
        return;
      }
      scheduledAt = scheduleDate.toISOString();
    } else if (wasScheduled) {
      scheduledAt = null;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const url = mode === "edit" ? "/api/activities/update" : "/api/activities/create";
      const bodyPayload: any = {
        title: trimmedTitle,
        points,
        eventDate: eventDate || null,
        location: location.trim() || null,
        description: description.trim() || null,
        imageUrl,
        isRegistrationOpen,
        isActive,
        scheduledAt,
      };

      if (mode === "edit" && initialActivity) {
        bodyPayload.id = initialActivity.id;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Thao tác không thành công.");
      }

      router.refresh();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Đã xảy ra lỗi khi lưu hoạt động.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-dusty-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dusty-border/70 px-5 py-4 sm:px-6 bg-gradient-to-r from-dusty-light/60 to-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <MaterialIcon className="text-[22px]" name="event_available" />
            </div>
            <div>
              <h2 className="text-title-md sm:text-title-lg font-bold text-on-surface">
                {mode === "create" ? "Tạo Hoạt động Mới" : "Chỉnh sửa Hoạt động"}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Quản trị viên phát động phong trào và cài đặt đăng ký tham gia
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high transition"
            type="button"
          >
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs sm:text-sm font-semibold text-red-900">
              {errorMessage}
            </div>
          )}

          {/* 1. Tên hoạt động */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-on-surface mb-1">
              Tên hoạt động <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Hội thi Cắm hoa Chào mừng 20-10, Giải Pickleball CDILV 2026..."
              className="w-full rounded-xl border border-dusty-border px-3.5 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* 2. Điểm thưởng & Ngày diễn ra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-on-surface mb-1">
                Điểm thưởng thi đua (+điểm)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-xl border border-dusty-border pl-3.5 pr-14 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-amber-700">
                  điểm
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-on-surface mb-1">
                Ngày tổ chức
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-xl border border-dusty-border px-3.5 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* 3. Địa điểm & Trạng thái mở đăng ký */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-on-surface mb-1">
                Địa điểm tổ chức
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="VD: Hội trường lớn Tầng 3, Sân thể thao..."
                className="w-full rounded-xl border border-dusty-border px-3.5 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-on-surface mb-1">
                Trạng thái nhận đăng ký
              </label>
              <select
                value={isRegistrationOpen ? "open" : "stopped"}
                onChange={(e) => setIsRegistrationOpen(e.target.value === "open")}
                className="w-full rounded-xl border border-dusty-border px-3.5 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
              >
                <option value="open">🟢 Đang mở nhận đăng ký</option>
                <option value="stopped">🔴 Đã dừng nhận đăng ký (Hết hạn)</option>
              </select>
            </div>
          </div>

          {/* Hiển thị: Active & hẹn giờ (giống bài viết) */}
          <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#173A67] focus:ring-[#173A67] cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-800">
                <MaterialIcon className="text-[16px] text-[#173A67]" name="visibility" />
                <span>Active — hiện hoạt động cho mọi người</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal mt-0.5">
                Bỏ chọn để giữ Inactive (nháp). Hoạt động Inactive chỉ quản trị viên xem và sửa được.
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
                <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-sky-950">
                  <MaterialIcon className="text-[16px] text-sky-700" name="schedule_send" />
                  <span>Hẹn giờ hiển thị</span>
                </div>
                <p className="text-[11px] text-sky-900/80 leading-normal mt-0.5">
                  {wasScheduled && !scheduleEnabled
                    ? "Bỏ hẹn giờ: hoạt động sẽ hiển thị ngay khi lưu."
                    : "Không chọn = hiển thị ngay. Đến giờ đã chọn, hoạt động tự hiện với đoàn viên; trước đó chỉ quản trị viên xem được."}
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
                {mode === "edit" && !wasScheduled && (
                  <p className="text-[11px] text-sky-900/80">
                    Hoạt động đang hiển thị sẽ tạm ẩn cho đến giờ hẹn.
                  </p>
                )}
                {!isActive && (
                  <p className="text-[11px] font-semibold text-amber-800">
                    Hoạt động đang Inactive: phải bật Active thì đến giờ hoạt động mới hiển thị.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 4. Ảnh đại diện hoạt động */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-on-surface mb-1">
              Ảnh đại diện hoạt động
            </label>

            {imageUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-dusty-border bg-slate-50 h-44 sm:h-52 w-full group">
                <img
                  src={imageUrl}
                  alt="Ảnh hoạt động"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-red-700 transition"
                  >
                    Xóa ảnh
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <label className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-dusty-border/80 bg-dusty-light/40 p-4 sm:p-5 text-center cursor-pointer hover:border-primary hover:bg-dusty-light/70 transition">
                  <MaterialIcon className="text-[28px] text-primary" name="add_photo_alternate" />
                  <span className="text-xs sm:text-sm font-bold text-on-surface">
                    {isCompressing ? "Đang xử lý nén ảnh..." : "Chọn ảnh từ máy / điện thoại"}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    JPG, PNG (Tự động nén tối ưu)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isCompressing}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 5. Mô tả / Thể lệ hoạt động */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-on-surface mb-1">
              Mô tả & Thể lệ tham gia
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập mục đích hoạt động, đối tượng tham gia, thể lệ thi đấu hoặc các lưu ý cho đoàn viên..."
              className="w-full rounded-xl border border-dusty-border p-3.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dusty-border/70">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-dusty-border px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-dusty-light/50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || isCompressing}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-dusty-dark transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <MaterialIcon className="text-[18px]" name="check" />
                  <span>{mode === "create" ? "Tạo hoạt động" : "Lưu thay đổi"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
