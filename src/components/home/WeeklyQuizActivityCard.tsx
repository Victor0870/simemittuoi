"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { WEEKLY_QUIZ_PROGRAM_ID } from "@/lib/quiz-shared";

const WEEKLY_QUIZ_HREF = `/quiz/${WEEKLY_QUIZ_PROGRAM_ID}`;

/**
 * Kiểm tra xem thời điểm hiện tại có nằm trong khoảng 21:00 đến 22:00 (9h - 10h tối) Thứ 2 hàng tuần theo giờ Việt Nam (Asia/Ho_Chi_Minh).
 */
function checkIsWeeklyQuizOpen(date: Date = new Date()): {
  isOpen: boolean;
  minutesRemaining: number;
  nextOpenText: string;
} {
  // Convert sang giờ Việt Nam (UTC+7)
  const vnString = date.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
  const vnTime = new Date(vnString);

  const dayOfWeek = vnTime.getDay(); // 0 = CN, 1 = Thứ 2, ..., 6 = Thứ 7
  const hour = vnTime.getHours();
  const minute = vnTime.getMinutes();

  // Khung giờ mở: Thứ 2 (dayOfWeek === 1), từ 21:00 đến trước 22:00
  const isOpen = dayOfWeek === 1 && hour === 21;

  let minutesRemaining = 0;
  if (isOpen) {
    minutesRemaining = 60 - minute;
  }

  // Tính thời gian mở tiếp theo
  let daysUntilMonday = (1 - dayOfWeek + 7) % 7;
  if (dayOfWeek === 1) {
    if (hour < 21) {
      daysUntilMonday = 0; // Tối nay 21:00
    } else {
      daysUntilMonday = 7; // Thứ 2 tuần sau
    }
  }

  const nextMonday = new Date(vnTime);
  nextMonday.setDate(vnTime.getDate() + daysUntilMonday);

  const nextOpenText =
    daysUntilMonday === 0
      ? "Tối nay lúc 21:00"
      : `Thứ Hai (${nextMonday.getDate().toString().padStart(2, "0")}/${(nextMonday.getMonth() + 1).toString().padStart(2, "0")}) lúc 21:00`;

  return { isOpen, minutesRemaining, nextOpenText };
}

export function WeeklyQuizActivityCard() {
  const [mounted, setMounted] = useState(false);
  const [quizStatus, setQuizStatus] = useState({
    isOpen: false,
    minutesRemaining: 0,
    nextOpenText: "Thứ Hai lúc 21:00",
  });

  useEffect(() => {
    setMounted(true);
    const update = () => {
      setQuizStatus(checkIsWeeklyQuizOpen(new Date()));
    };

    update();
    // Cập nhật mỗi 2 phút để tự động mở/đóng đúng giờ
    const interval = setInterval(update, 120000);
    return () => clearInterval(interval);
  }, []);

  const isOpen = mounted ? quizStatus.isOpen : false;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-dusty-border/80 bg-surface-container-lowest shadow-sm transition-all hover:shadow-md sm:flex-row">
      {/* Activity Image / Visual Banner */}
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#173A67] via-[#1E4A7D] to-[#27496D] sm:h-auto sm:w-2/5 shrink-0 flex flex-col items-center justify-center p-6 text-white text-center">
        {/* Decorative background circle */}
        <div className="absolute -top-12 -left-12 h-36 w-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 h-36 w-36 rounded-full bg-amber-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-xs shadow-inner">
            <MaterialIcon className="text-[34px] text-amber-300" name="quiz" />
          </div>
          <span className="text-xs font-black tracking-widest text-amber-300 uppercase">
            Hàng tuần
          </span>
          <p className="text-sm font-extrabold text-white mt-0.5">Tri Thức Công Đoàn</p>
        </div>

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start z-20">
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/95 px-2.5 py-1 text-label-sm font-bold text-white backdrop-blur-xs shadow-xs">
            <MaterialIcon className="text-[14px]" name="stars" />
            +2đ/lượt · Thưởng Top đến +15đ
          </span>

          {isOpen ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-xs animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Đang mở thi
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] font-bold text-amber-200 backdrop-blur-xs shadow-xs">
              <MaterialIcon className="text-[12px]" name="schedule" />
              21h - 22h Tối Thứ 2
            </span>
          )}
        </div>
      </div>

      {/* Card Content & Action Buttons */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={WEEKLY_QUIZ_HREF} className="flex-1 min-w-0">
              <h4 className="text-headline-sm font-bold text-[#173A67] transition-colors group-hover:text-primary leading-snug">
                Thi trắc nghiệm hàng tuần
              </h4>
            </Link>

            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              Trực tuyến
            </span>
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1 font-semibold text-[#173A67]">
              <MaterialIcon className="text-[16px] text-primary" name="calendar_month" />
              <span>21:00 – 22:00, Thứ 2 hàng tuần</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <MaterialIcon className="text-[16px] text-primary" name="devices" />
              <span>Website CDILV</span>
            </span>
          </p>

          <p className="mt-2 line-clamp-2 text-xs sm:text-body-sm text-on-surface-variant/90 leading-relaxed">
            Tham gia trả lời các câu hỏi trắc nghiệm tìm hiểu kiến thức công đoàn, chế độ chính sách và pháp luật lao động. Trả lời nhanh và chính xác để nhận điểm thi đua!
          </p>

          {/* Trạng thái giờ mở */}
          <div className="mt-3">
            {isOpen ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <MaterialIcon className="text-[16px] text-emerald-600 animate-spin" name="timer" />
                <span>Khung giờ vàng đang mở! Còn {quizStatus.minutesRemaining} phút nữa.</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50/80 border border-amber-200/80 px-2.5 py-1 text-xs text-amber-900 font-medium">
                <MaterialIcon className="text-[16px] text-amber-700" name="info" />
                <span>Đợt thi tiếp theo: <strong>{quizStatus.nextOpenText}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Toolbar: LUÔN NẰM TRÊN 1 DÒNG DUY NHẤT */}
        <div className="mt-4 border-t border-dusty-border/70 pt-3">
          <div className="flex items-center gap-2 w-full flex-nowrap">
            {/* Button 1: Xem bảng xếp hạng tuần / Thể lệ */}
            <Link
              href={WEEKLY_QUIZ_HREF}
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-dusty-border bg-white px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs md:text-sm font-semibold text-on-surface transition hover:bg-dusty-light/60 hover:text-primary shadow-2xs whitespace-nowrap"
              title="Xem thể lệ và bảng xếp hạng tuần"
            >
              <MaterialIcon
                className="text-[15px] sm:text-[17px] text-primary shrink-0"
                name="leaderboard"
              />
              <span className="truncate">Xem BXH tuần</span>
            </Link>

            {/* Button 2: Nút Tham gia ngay (Chỉ hoạt động từ 21h đến 22h Thứ 2 hàng tuần, bình thường bị mờ đi) */}
            <div className="flex-1 min-w-0 flex items-center justify-center">
              {isOpen ? (
                <Link
                  href={WEEKLY_QUIZ_HREF}
                  className="w-full min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl bg-emerald-600 px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs md:text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 animate-pulse whitespace-nowrap"
                  title="Đang trong khung giờ thi! Bấm để vào làm bài ngay"
                >
                  <MaterialIcon className="text-[16px] sm:text-[18px] shrink-0" name="play_arrow" />
                  <span className="truncate">Tham gia ngay</span>
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full min-w-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs md:text-sm font-bold text-slate-400 opacity-50 cursor-not-allowed select-none whitespace-nowrap shadow-none"
                  title="Cuộc thi chỉ hoạt động trong khoảng 9h đến 10h tối (21:00 - 22:00) Thứ 2 hàng tuần"
                >
                  <MaterialIcon className="text-[15px] sm:text-[17px] shrink-0 text-slate-400" name="lock" />
                  <span className="truncate">Tham gia ngay</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
