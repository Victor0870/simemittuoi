"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { ActivityEditorModal } from "@/components/activities/ActivityEditorModal";
import type { ActivityDetail } from "@/lib/data/activities";
import { formatScheduleLabel } from "@/lib/post-schedule";

type Props = {
  activities: ActivityDetail[];
};

export function AdminActivitiesManager({ activities }: Props) {
  const router = useRouter();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  function showToast(type: "success" | "error", text: string) {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  }

  function handleCreate() {
    setSelectedActivity(null);
    setEditorMode("create");
    setIsEditorOpen(true);
  }

  function handleEdit(act: ActivityDetail) {
    setSelectedActivity({
      id: act.id,
      title: act.title,
      description: act.description,
      location: act.location,
      date: act.eventDate || "",
      points: act.points,
      imageUrl: act.imageUrl,
      isRegistrationOpen: act.isRegistrationOpen,
      isActive: act.isActive,
      publishedAt: act.publishedAt,
    });
    setEditorMode("edit");
    setIsEditorOpen(true);
  }

  async function handleToggleRegistration(activityId: string, currentOpen: boolean, title: string) {
    if (busyId) return;

    const nextOpen = !currentOpen;
    const actionText = nextOpen ? "mở lại đăng ký" : "dừng nhận đăng ký";
    const confirmed = window.confirm(`Xác nhận ${actionText} cho hoạt động "${title}"?`);
    if (!confirmed) return;

    setBusyId(activityId);
    setFeedback(null);

    try {
      const res = await fetch("/api/activities/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, isOpen: nextOpen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thao tác không thành công.");

      showToast("success", data.message || "Đã cập nhật trạng thái hoạt động!");
      router.refresh();
    } catch (err: any) {
      showToast("error", err.message || "Lỗi khi cập nhật trạng thái.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(activityId: string, title: string) {
    if (busyId) return;

    const confirmed = window.confirm(
      `CẢNH BÁO: Bạn có chắc chắn muốn xóa hoạt động "${title}"? Toàn bộ danh sách đăng ký tham gia cũng sẽ bị xóa vĩnh viễn.`,
    );
    if (!confirmed) return;

    setBusyId(activityId);
    setFeedback(null);

    try {
      const res = await fetch(`/api/activities/delete?id=${encodeURIComponent(activityId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa không thành công.");

      showToast("success", "Đã xóa hoạt động thành công!");
      router.refresh();
    } catch (err: any) {
      showToast("error", err.message || "Lỗi khi xóa hoạt động.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Admin Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">
            Quản Lý Hoạt Động & Phong Trào
          </h1>
          <p className="text-body-md text-[#27496D]">
            Tạo hoạt động mới, phát động phong trào, cập nhật thể lệ, quản lý đăng ký và kiểm tra danh sách đoàn viên tham gia.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCreate}
            type="button"
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-amber-600 transition cursor-pointer"
          >
            <MaterialIcon name="add_circle" />
            <span>+ Tạo hoạt động mới</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl p-4 text-sm font-semibold animate-in fade-in duration-200 border ${
            feedback.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Activities List */}
      {activities.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-dusty-border bg-white p-12 text-center">
          <MaterialIcon className="mx-auto mb-3 text-[48px] text-on-surface-variant/40" name="event_busy" />
          <h3 className="text-lg font-bold text-on-surface">Chưa có hoạt động nào</h3>
          <p className="mt-1 text-sm text-on-surface-variant max-w-md mx-auto">
            Hãy bấm nút &quot;+ Tạo hoạt động mới&quot; ở trên để phát động phong trào cho đơn vị!
          </p>
          <button
            onClick={handleCreate}
            type="button"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 font-bold text-white shadow-sm hover:bg-dusty-dark transition"
          >
            <MaterialIcon name="add" />
            <span>Tạo hoạt động ngay</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs sm:text-sm text-on-surface-variant font-medium">
            <span>Tổng cộng: <strong className="text-on-surface">{activities.length}</strong> hoạt động</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {activities.map((act) => (
              <div
                key={act.id}
                className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-dusty-border/80 bg-white p-5 shadow-xs transition hover:shadow-md"
              >
                {/* Activity basic info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-dusty-light border border-dusty-border">
                    {act.imageUrl ? (
                      <img
                        src={act.imageUrl}
                        alt={act.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-primary">
                        <MaterialIcon className="text-[28px]" name="event" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-on-surface truncate">
                        {act.title}
                      </h3>

                      {!act.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-label-xs font-bold text-slate-600">
                          <MaterialIcon className="text-[12px]" name="visibility_off" />
                          Inactive
                        </span>
                      ) : act.isScheduled ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-label-xs font-bold text-sky-900"
                          title="Đến giờ hẹn, hoạt động tự hiện với đoàn viên"
                        >
                          <MaterialIcon className="text-[12px]" name="schedule_send" />
                          Hẹn giờ {formatScheduleLabel(act.publishedAt)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-label-xs font-bold text-emerald-800">
                          <MaterialIcon className="text-[12px]" name="visibility" />
                          Active
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-label-xs font-bold text-amber-900">
                        +{act.points}đ
                      </span>

                      {act.isRegistrationOpen ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-label-xs font-bold text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Đang mở ĐK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-label-xs font-bold text-red-800">
                          Đã dừng ĐK
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-on-surface-variant flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {act.dateLabel && (
                        <span>📅 {act.dateLabel}</span>
                      )}
                      {act.location && (
                        <span>📍 {act.location}</span>
                      )}
                    </p>

                    {act.description && (
                      <p className="text-xs text-on-surface-variant/80 line-clamp-1">
                        {act.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions & participant count */}
                <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-dusty-border/60">
                  <Link
                    href={`/activities/${act.id}`}
                    className="inline-flex items-center gap-1 rounded-xl border border-dusty-border bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-primary hover:bg-dusty-light transition"
                    title={
                      act.isActive && !act.isScheduled
                        ? "Xem chi tiết bài viết và danh sách người tham gia"
                        : "Xem trước hoạt động (chỉ quản trị viên thấy) và danh sách người tham gia"
                    }
                  >
                    <MaterialIcon className="text-[16px]" name={act.isActive && !act.isScheduled ? "groups" : "visibility"} />
                    <span>
                      {act.isActive && !act.isScheduled ? "Xem danh sách" : "Xem trước"} ({act.participantCount})
                    </span>
                  </Link>

                  {/* Toggle registration */}
                  <button
                    onClick={() => handleToggleRegistration(act.id, act.isRegistrationOpen, act.title)}
                    disabled={busyId === act.id}
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs sm:text-sm font-bold transition disabled:opacity-50 ${
                      act.isRegistrationOpen
                        ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    }`}
                  >
                    <MaterialIcon
                      className="text-[16px]"
                      name={act.isRegistrationOpen ? "pause_circle" : "play_circle"}
                    />
                    <span>{act.isRegistrationOpen ? "Dừng ĐK" : "Mở lại ĐK"}</span>
                  </button>

                  {/* Edit button */}
                  <button
                    onClick={() => handleEdit(act)}
                    disabled={busyId === act.id}
                    type="button"
                    title="Chỉnh sửa hoạt động"
                    className="rounded-xl border border-dusty-border bg-white p-2 text-on-surface-variant hover:bg-dusty-light hover:text-primary transition"
                  >
                    <MaterialIcon className="text-[18px]" name="edit" />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(act.id, act.title)}
                    disabled={busyId === act.id}
                    type="button"
                    title="Xóa hoạt động"
                    className="rounded-xl border border-red-200 bg-red-50/60 p-2 text-red-600 hover:bg-red-100 transition"
                  >
                    <MaterialIcon className="text-[18px]" name="delete_outline" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Editor Modal */}
      <ActivityEditorModal
        isOpen={isEditorOpen}
        mode={editorMode}
        initialActivity={selectedActivity}
        onClose={() => setIsEditorOpen(false)}
      />
    </div>
  );
}
