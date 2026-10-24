"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";
import { ActivityEditorModal } from "@/components/activities/ActivityEditorModal";
import type { Activity } from "@/lib/mock-data";

type ActivityCardProps = {
  activity: Activity;
};

export function ActivityCard({ activity }: ActivityCardProps) {
  const router = useRouter();
  const { isGuest, isAdmin } = useAuth();

  const [isRegistered, setIsRegistered] = useState(activity.isRegistered ?? false);
  useEffect(() => {
    setIsRegistered(activity.isRegistered ?? false);
  }, [activity.isRegistered]);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(
    activity.isRegistrationOpen !== false,
  );
  const [participantCount, setParticipantCount] = useState(
    activity.participantCount ?? 0,
  );
  const [loading, setLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  function showToast(type: "success" | "error", text: string) {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  }

  async function handleDeleteActivity() {
    if (loading) return;

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa hoạt động "${activity.title}"? Dữ liệu người đăng ký cũng sẽ bị xóa vĩnh viễn.`,
    );
    if (!confirmed) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/activities/delete?id=${encodeURIComponent(activity.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Xóa không thành công.");
      }

      showToast("success", "Đã xóa hoạt động thành công!");
      router.refresh();
    } catch (err: any) {
      showToast("error", err.message || "Lỗi khi xóa hoạt động.");
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (loading) return;

    if (isGuest) {
      if (
        window.confirm(
          "Vui lòng đăng nhập tài khoản Đoàn viên để đăng ký tham gia hoạt động.",
        )
      ) {
        router.push("/login?next=/");
      }
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/activities/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Đăng ký không thành công.");
      }

      setIsRegistered(true);
      setParticipantCount((prev) => prev + 1);
      showToast("success", data.message || "Đăng ký tham gia thành công!");
      router.refresh();
    } catch (err: any) {
      showToast("error", err.message || "Lỗi khi đăng ký tham gia.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (loading) return;

    const confirmed = window.confirm(
      "Bạn có chắc chắn muốn hủy đăng ký tham gia hoạt động này?",
    );
    if (!confirmed) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/activities/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Hủy đăng ký không thành công.");
      }

      setIsRegistered(false);
      setParticipantCount((prev) => Math.max(0, prev - 1));
      showToast("success", data.message || "Đã hủy đăng ký thành công.");
      router.refresh();
    } catch (err: any) {
      showToast("error", err.message || "Lỗi khi hủy đăng ký.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAdmin(targetOpen: boolean) {
    if (loading) return;

    const actionText = targetOpen ? "mở lại đăng ký" : "dừng nhận đăng ký";
    const confirmed = window.confirm(
      `Xác nhận ${actionText} cho hoạt động "${activity.title}"?`,
    );
    if (!confirmed) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/activities/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id, isOpen: targetOpen }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Cập nhật không thành công.");
      }

      setIsRegistrationOpen(targetOpen);
      showToast("success", data.message || "Cập nhật trạng thái thành công!");
      router.refresh();
    } catch (err: any) {
      showToast("error", err.message || "Lỗi khi cập nhật trạng thái.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-dusty-border/80 bg-surface-container-lowest shadow-sm transition-all hover:shadow-md sm:flex-row">
      {/* Activity Image / Badge */}
      <div className="relative h-48 overflow-hidden bg-dusty-light sm:h-auto sm:w-2/5 shrink-0">
        {activity.imageUrl ? (
          <Image
            alt={activity.imageAlt || activity.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            height={240}
            src={activity.imageUrl}
            unoptimized
            width={320}
          />
        ) : (
          <div className="flex h-full min-h-48 items-center justify-center text-primary bg-dusty-light/70">
            <MaterialIcon className="text-[48px]" name="event" />
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          <span className="inline-flex items-center gap-1 rounded-md bg-dusty-deep/90 px-2.5 py-1 text-label-sm font-bold text-white backdrop-blur-xs shadow-xs">
            <MaterialIcon className="text-[14px]" name="stars" />
            +{activity.points} điểm
          </span>

          {!isRegistrationOpen && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-600/90 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs shadow-xs">
              <MaterialIcon className="text-[12px]" name="lock" />
              Đã dừng đăng ký
            </span>
          )}
        </div>
      </div>

      {/* Card Content & Action Buttons */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={`/activities/${activity.id}`} className="flex-1 min-w-0">
              <h4 className="text-headline-sm font-bold text-on-surface transition-colors group-hover:text-primary leading-snug">
                {activity.title}
              </h4>
            </Link>

            {/* Admin Management Toolbar */}
            {isAdmin && (
              <div className="flex items-center gap-1 shrink-0 rounded-lg bg-surface-container/60 p-0.5 border border-dusty-border/60">
                {isRegistrationOpen ? (
                  <button
                    onClick={() => handleToggleAdmin(false)}
                    disabled={loading}
                    type="button"
                    title="Quyền Admin: Dừng nhận đăng ký hoạt động này"
                    className="inline-flex items-center gap-0.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                  >
                    <MaterialIcon className="text-[13px] text-amber-700" name="pause_circle" />
                    <span>Dừng ĐK</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleAdmin(true)}
                    disabled={loading}
                    type="button"
                    title="Quyền Admin: Mở lại nhận đăng ký"
                    className="inline-flex items-center gap-0.5 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <MaterialIcon className="text-[13px] text-emerald-600" name="play_circle" />
                    <span>Mở ĐK</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  disabled={loading}
                  title="Admin: Chỉnh sửa thông tin"
                  className="rounded-md p-1 text-on-surface-variant hover:bg-white hover:text-primary transition"
                >
                  <MaterialIcon className="text-[15px]" name="edit" />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteActivity}
                  disabled={loading}
                  title="Admin: Xóa hoạt động"
                  className="rounded-md p-1 text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition"
                >
                  <MaterialIcon className="text-[15px]" name="delete_outline" />
                </button>
              </div>
            )}
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-on-surface-variant">
            {activity.date ? (
              <span className="inline-flex items-center gap-1">
                <MaterialIcon className="text-[16px] text-primary" name="calendar_month" />
                {activity.date}
              </span>
            ) : null}
            {activity.location ? (
              <span className="inline-flex items-center gap-1">
                <MaterialIcon className="text-[16px] text-primary" name="location_on" />
                {activity.location}
              </span>
            ) : null}
          </p>

          {activity.description ? (
            <p className="mt-2 line-clamp-2 text-xs sm:text-body-sm text-on-surface-variant/90 leading-relaxed">
              {activity.description}
            </p>
          ) : null}

          {feedback && (
            <div
              className={`mt-2.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>

        {/* Action Buttons Toolbar: LUÔN NẰM TRÊN 1 DÒNG DUY NHẤT */}
        <div className="mt-4 border-t border-dusty-border/70 pt-3">
          <div className="flex items-center gap-2 w-full flex-nowrap">
            {/* Button 1: Nút xem Danh sách đăng ký */}
            <Link
              href={`/activities/${activity.id}`}
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-dusty-border bg-white px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs md:text-sm font-semibold text-on-surface transition hover:bg-dusty-light/60 hover:text-primary shadow-2xs whitespace-nowrap"
              title="Xem bài viết & danh sách những người đã tham gia"
            >
              <MaterialIcon
                className="text-[15px] sm:text-[17px] text-primary shrink-0"
                name="format_list_bulleted"
              />
              <span className="truncate">Danh sách đăng ký ({participantCount})</span>
            </Link>

            {/* Button 2: Nút Đăng ký / Đã tham gia / Hết hạn */}
            <div className="flex-1 min-w-0 flex items-center justify-center">
              {isRegistered ? (
                <div className="flex items-center gap-1 w-full min-w-0">
                  <span className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-1.5 sm:px-2.5 py-1.5 sm:py-2 text-[11px] sm:text-xs md:text-sm font-bold text-emerald-800 shadow-2xs whitespace-nowrap">
                    <MaterialIcon
                      className="text-[14px] sm:text-[16px] text-emerald-600 shrink-0"
                      name="check_circle"
                    />
                    <span className="truncate">Đã tham gia</span>
                  </span>
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    type="button"
                    title="Hủy đăng ký tham gia"
                    className="shrink-0 inline-flex items-center justify-center gap-0.5 rounded-xl border border-red-200 bg-red-50/70 px-1.5 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
                  >
                    <MaterialIcon className="text-[13px] sm:text-[14px]" name="close" />
                    <span>Hủy</span>
                  </button>
                </div>
              ) : isRegistrationOpen ? (
                <button
                  onClick={handleRegister}
                  disabled={loading}
                  type="button"
                  className="w-full min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl bg-primary px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs md:text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:opacity-50 whitespace-nowrap"
                >
                  <MaterialIcon className="text-[15px] sm:text-[17px] shrink-0" name="how_to_reg" />
                  <span className="truncate">Đăng ký tham gia</span>
                </button>
              ) : (
                <button
                  disabled
                  type="button"
                  className="w-full min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-dusty-border bg-slate-100 px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs md:text-sm font-bold text-slate-400 opacity-60 cursor-not-allowed whitespace-nowrap"
                  title="Hoạt động đã dừng hoặc hết hạn nhận đăng ký"
                >
                  <MaterialIcon className="text-[15px] sm:text-[17px] shrink-0" name="block" />
                  <span className="truncate">Hết hạn đăng ký</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Edit Modal */}
      {isAdmin && isEditOpen && (
        <ActivityEditorModal
          isOpen={isEditOpen}
          mode="edit"
          initialActivity={activity}
          onClose={() => setIsEditOpen(false)}
        />
      )}
    </article>
  );
}
