"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatQuizTime, WEEKLY_QUIZ_PROGRAM_ID, type QuizStatus } from "@/lib/quiz-shared";

const POLL_MS = 300_000;

function dismissKey(sessionId: string) {
  return `cdilv_quiz_popup_${sessionId}`;
}

/** Popup báo sự kiện thi trắc nghiệm đã bắt đầu — mỗi đợt hiện 1 lần trong mỗi phiên trình duyệt. */
export function QuizEventPopup() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { user, isApproved } = useAuth();
  const [status, setStatus] = useState<QuizStatus | null>(null);
  const [visible, setVisible] = useState(false);
  const isAdminArea = pathname.startsWith("/admin");

  useEffect(() => {
    if (!user || !isApproved || isAdminArea) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/quiz/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as QuizStatus;
        if (!cancelled) setStatus(data);
      } catch {
        // bỏ qua lỗi mạng, lần kiểm tra sau sẽ thử lại
      }
    }
    void check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user, isApproved, isAdminArea]);

  useEffect(() => {
    const session = status?.session;
    const canPlay =
      status?.isOpen && (status.hasInProgress || status.attemptsUsed < status.maxAttempts);
    if (!session || !canPlay || pathname.startsWith("/quiz")) {
      setVisible(false);
      return;
    }
    setVisible(window.sessionStorage.getItem(dismissKey(session.id)) !== "1");
  }, [status, pathname]);

  if (!visible || !status?.session) return null;

  function close(goToQuiz: boolean) {
    if (status?.session) window.sessionStorage.setItem(dismissKey(status.session.id), "1");
    setVisible(false);
    if (goToQuiz) router.push(`/quiz/${WEEKLY_QUIZ_PROGRAM_ID}`);
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-[#173A67] via-[#1E4A7D] to-[#27496D] px-6 py-6 text-center text-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
            <MaterialIcon className="text-[32px] text-amber-300" name="quiz" />
          </div>
          <h2 className="mt-3 text-xl font-extrabold">Thi trắc nghiệm hàng tuần đã bắt đầu!</h2>
          <p className="mt-1 text-sm text-white/80">
            Sự kiện mở đến {formatQuizTime(status.session.endsAt)} hôm nay
          </p>
        </div>
        <div className="space-y-2 px-6 py-5 text-sm text-on-surface">
          <p>
            Trả lời đúng cả {status.questionsPerAttempt} câu hỏi trong thời gian nhanh nhất để vào bảng xếp
            hạng và nhận điểm thi đua.
          </p>
          <p className="text-on-surface-variant">
            Bạn có tối đa {status.maxAttempts} lượt chơi (đã dùng {status.attemptsUsed}), hệ thống lấy kết
            quả cao nhất.
          </p>
        </div>
        <div className="flex gap-2 border-t border-dusty-border/70 px-6 py-4">
          <button
            className="flex-1 rounded-xl border border-dusty-border px-4 py-2.5 text-sm font-bold text-on-surface-variant"
            type="button"
            onClick={() => close(false)}
          >
            Để sau
          </button>
          <button
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-extrabold text-white shadow-sm"
            type="button"
            onClick={() => close(true)}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
