"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShortcutLink } from "@/components/admin/AdminShortcutLink";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";

type Props = {
  activityId: string;
  activityTitle: string;
  initialIsRegistered: boolean;
  initialIsRegistrationOpen: boolean;
};

export function ActivityDetailActionButtons({
  activityId,
  initialIsRegistered,
  initialIsRegistrationOpen: isRegistrationOpen,
}: Props) {
  const router = useRouter();
  const { isGuest } = useAuth();

  const [isRegistered, setIsRegistered] = useState(initialIsRegistered);
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
        router.push(`/login?next=/activities/${activityId}`);
      }
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/activities/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Đăng ký không thành công.");
      }

      setIsRegistered(true);
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
        body: JSON.stringify({ activityId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Hủy đăng ký không thành công.");
      }

      setIsRegistered(false);
      showToast("success", data.message || "Đã hủy đăng ký thành công.");
      router.refresh();
    } catch (err: any) {
      showToast("error", err.message || "Lỗi khi hủy đăng ký.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {feedback && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <AdminShortcutLink href="/admin/activities" icon="event_available" label="Mở / dừng đăng ký" />

        {/* Member button */}
        {isRegistered ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-800 shadow-xs">
              <MaterialIcon className="text-[18px] text-emerald-600" name="check_circle" />
              <span>Đã đăng ký tham gia</span>
            </span>

            <button
              onClick={handleCancel}
              disabled={loading}
              type="button"
              className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/70 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              <MaterialIcon className="text-[16px]" name="close" />
              <span>Hủy tham gia</span>
            </button>
          </div>
        ) : isRegistrationOpen ? (
          <button
            onClick={handleRegister}
            disabled={loading}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:opacity-50"
          >
            <MaterialIcon className="text-[18px]" name="how_to_reg" />
            <span>Đăng ký tham gia ngay</span>
          </button>
        ) : (
          <button
            disabled
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-dusty-border bg-slate-100 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-400 opacity-50 cursor-not-allowed"
          >
            <MaterialIcon className="text-[18px]" name="block" />
            <span>Hết hạn đăng ký</span>
          </button>
        )}
      </div>
    </div>
  );
}
