import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { WEEKDAY_LABELS, formatQuizDateTime, formatQuizTime, type QuizSettings } from "@/lib/quiz-shared";

export type QuizProgramCardData = {
  id: string;
  name: string;
  description: string | null;
  isOpen: boolean;
  openEndsAt: string | null;
  nextStartAt: string | null;
  settings: QuizSettings;
};

/** Thẻ chương trình trắc nghiệm trên trang /quiz (cùng phong cách thẻ Bình chọn). */
export function QuizProgramCard({ program }: { program: QuizProgramCardData }) {
  const { settings } = program;
  return (
    <Link
      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-xs transition hover:border-primary hover:shadow-md sm:p-6"
      href={`/quiz/${program.id}`}
    >
      <div>
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5 sm:mb-3.5 sm:gap-2">
          {program.isOpen ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 sm:text-label-xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600 sm:h-2 sm:w-2" />
              {program.openEndsAt ? `Đang mở đến ${formatQuizTime(program.openEndsAt)}` : "Đang mở"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-high px-2.5 py-0.5 text-[11px] font-bold text-on-surface-variant sm:text-label-xs">
              <MaterialIcon className="text-[13px]" name="schedule" />
              Chưa mở
            </span>
          )}
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary sm:text-label-xs">
            {settings.schedule_mode === "auto"
              ? `${WEEKDAY_LABELS[settings.schedule_weekday]} hằng tuần, ${settings.start_time}–${settings.end_time}`
              : "Mở theo thông báo"}
          </span>
        </div>

        <h3 className="text-base font-bold leading-snug text-[#173A67] transition group-hover:text-primary sm:text-title-lg">
          {program.name}
        </h3>
        {program.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-on-surface-variant sm:mt-2 sm:text-body-md">
            {program.description}
          </p>
        ) : null}

        {!program.isOpen && program.nextStartAt ? (
          <p className="mt-2.5 flex items-start gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-900 sm:text-xs">
            <MaterialIcon className="shrink-0 text-[15px] text-sky-600" name="event" />
            <span>Lần thi tiếp theo: {formatQuizDateTime(program.nextStartAt)}</span>
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#27496D] sm:mt-4 sm:gap-3 sm:text-label-xs">
          <span className="flex items-center gap-1">
            <MaterialIcon className="text-[15px] text-amber-600 sm:text-[16px]" name="quiz" />
            {settings.questions_per_attempt} câu / {settings.time_limit_seconds} giây
          </span>
          <span className="flex items-center gap-1">
            <MaterialIcon className="text-[15px] text-primary sm:text-[16px]" name="replay" />
            Tối đa {settings.max_attempts} lượt
          </span>
          <span className="flex items-center gap-1">
            <MaterialIcon className="text-[15px] text-emerald-600 sm:text-[16px]" name="military_tech" />
            Đúng hết +{settings.base_points}đ
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-outline-variant/60 pt-3 sm:mt-6 sm:pt-4">
        <span className="text-xs font-semibold text-on-surface-variant sm:text-label-sm">
          {program.isOpen ? "Vào làm bài ngay" : "Xem thể lệ & bảng xếp hạng"}
        </span>
        <span className="flex items-center gap-1 text-xs font-bold text-primary transition group-hover:translate-x-1 sm:text-label-md">
          {program.isOpen ? "Vào thi" : "Xem"}
          <MaterialIcon name="arrow_forward" />
        </span>
      </div>
    </Link>
  );
}
