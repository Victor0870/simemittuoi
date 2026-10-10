"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Activity } from "@/lib/mock-data";

type ActivityCardProps = {
  activity: Activity;
};

export function ActivityCard({ activity }: ActivityCardProps) {
  const router = useRouter();
  const { isGuest, isAdmin } = useAuth();

  const [isRegistered, setIsRegistered] = useState(activity.isRegistered ?? false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(
    activity.isRegistrationOpen !== false,
  );
  const [participantCount, setParticipantCount] = useState(
    activity.participantCount ?? 0,
  );
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  function showToast(type: "success" | "error", text: string) {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
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
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <Link href={`/activities/${activity.id}`}>
            <h4 className="text-headline-sm font-bold text-on-surface transition-colors group-hover:text-primary leading-snug">
              {activity.title}
            </h4>
          </Link>

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

        {/* Action Buttons Toolbar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-dusty-border/70 pt-3">
          {/* Button 1: Nút xem Danh sách đăng ký */}
          <Link
            href={`/activities/${activity.id}`}
            className="inline-flex items-center gap-1 rounded-xl border border-dusty-border bg-white px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-on-surface transition hover:bg-dusty-light/60 hover:text-primary"
            title="Xem bài viết & danh sách những người đã tham gia"
          >
            <MaterialIcon className="text-[16px] text-primary" name="format_list_bulleted" />
            <span>Danh sách đăng ký ({participantCount})</span>
          </Link>

          {/* Buttons 2: Nút Đăng ký / Đã tham gia / Hủy tham gia / Admin dừng đăng ký */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Admin control button: Dừng đăng ký / Mở lại */}
            {isAdmin && (
              isRegistrationOpen ? (
                <button
                  onClick={() => handleToggleAdmin(false)}
                  disabled={loading}
                  type="button"
                  title="Quyền Admin: Dừng nhận đăng ký hoạt động này"
                  className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  <MaterialIcon className="text-[16px] text-amber-700" name="pause_circle" />
                  <span>Dừng đăng ký</span>
                </button>
              ) : (
                <button
                  onClick={() => handleToggleAdmin(true)}
                  disabled={loading}
                  type="button"
                  title="Quyền Admin: Mở lại nhận đăng ký"
                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  <MaterialIcon className="text-[16px] text-emerald-600" name="play_circle" />
                  <span>Mở lại ĐK</span>
                </button>
              )
            )}

            {/* User status buttons */}
            {isRegistered ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-emerald-800">
                  <MaterialIcon className="text-[16px] text-emerald-600" name="check_circle" />
                  <span>Đã tham gia</span>
                </span>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  type="button"
                  title="Hủy đăng ký tham gia"
                  className="inline-flex items-center gap-0.5 rounded-xl border border-red-200 bg-red-50/70 px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <MaterialIcon className="text-[15px]" name="close" />
                  <span>Hủy</span>
                </button>
              </div>
            ) : isRegistrationOpen ? (
              <button
                onClick={handleRegister}
                disabled={loading}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:opacity-50"
              >
                <MaterialIcon className="text-[16px]" name="how_to_reg" />
                <span>Đăng ký tham gia</span>
              </button>
            ) : (
              <button
                disabled
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-dusty-border bg-slate-100 px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-slate-400 opacity-50 cursor-not-allowed"
                title="Hoạt động đã dừng hoặc hết hạn nhận đăng ký"
              >
                <MaterialIcon className="text-[16px]" name="block" />
                <span>Hết hạn đăng ký</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
