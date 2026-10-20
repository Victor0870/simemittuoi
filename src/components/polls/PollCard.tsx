import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollSummary } from "@/lib/data/polls";
import { POLL_PHASE_META, formatPollTime, getPollPhase } from "@/lib/polls/phase";

type Props = {
  poll: PollSummary;
};

export function PollCard({ poll }: Props) {
  const phase = getPollPhase(poll);
  const isClosed = phase === "closed";
  const isOpen = phase === "open";
  const isUpcoming = phase === "upcoming";
  const phaseMeta = POLL_PHASE_META[phase];

  return (
    <Link
      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6 shadow-xs transition hover:border-primary hover:shadow-md"
      href={`/polls/${poll.id}`}
    >
      <div>
        {/* Badges */}
        <div className="mb-2.5 sm:mb-3.5 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] sm:text-label-xs font-bold ${phaseMeta.chip}`}
            >
              {isOpen ? (
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-600 animate-pulse" />
              ) : (
                <MaterialIcon className="text-[13px]" name={phaseMeta.icon} />
              )}
              {phaseMeta.label}
            </span>

            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] sm:text-label-xs font-semibold text-primary">
              {poll.pollType === "vote" ? "Bình chọn / Vote" : "Trả lời câu hỏi"}
            </span>

            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] sm:text-label-xs font-semibold text-on-surface-variant">
              {poll.accessType === "free" ? "Công khai (Free)" : "Đoàn viên"}
            </span>

            {poll.hasJudges ? (
              <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] sm:text-label-xs font-bold text-amber-900 inline-flex items-center gap-1">
                <MaterialIcon className="text-[13px] text-amber-700" name="gavel" />
                <span>Có BGK ({poll.judgeWeightPercent ?? 30}%)</span>
              </span>
            ) : null}
          </div>

          <span className="text-[11px] sm:text-label-xs text-on-surface-variant">
            {new Date(poll.createdAt).toLocaleDateString("vi-VN")}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-title-lg font-bold text-[#173A67] transition group-hover:text-primary leading-snug">
          {poll.title}
        </h3>

        {/* Description */}
        {poll.description ? (
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-body-md text-on-surface-variant line-clamp-2 leading-relaxed">
            {poll.description}
          </p>
        ) : null}

        {isUpcoming ? (
          <p className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-[11px] sm:text-xs font-semibold text-sky-900">
            <MaterialIcon className="text-[15px] text-sky-600 shrink-0" name="schedule" />
            <span>
              {poll.opensAt ? `Mở bình chọn lúc ${formatPollTime(poll.opensAt)}. ` : "Sắp mở bình chọn. "}
              Có thể vào xem tác phẩm và bình chọn thử trước.
            </span>
          </p>
        ) : null}

        {/* Features badges */}
        <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-label-xs text-[#27496D]">
          <span className="flex items-center gap-1">
            <MaterialIcon className="text-[15px] sm:text-[16px] text-amber-600" name="how_to_vote" />
            Vote tối đa {poll.maxVotesPerUser} tác phẩm
          </span>
          {poll.hasPrediction ? (
            <span className="flex items-center gap-1">
              <MaterialIcon className="text-[15px] sm:text-[16px] text-emerald-600" name="stars" />
              Có dự đoán trúng thưởng (+{poll.predictorRewardPoints}đ)
            </span>
          ) : null}
          {poll.voterRewardPoints > 0 ? (
            <span className="flex items-center gap-1">
              <MaterialIcon className="text-[15px] sm:text-[16px] text-primary" name="card_giftcard" />
              Thưởng tham gia +{poll.voterRewardPoints}đ
            </span>
          ) : null}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-4 sm:mt-6 flex items-center justify-between border-t border-outline-variant/60 pt-3 sm:pt-4">
        <span className="text-xs sm:text-label-sm font-semibold text-on-surface-variant">
          {isClosed
            ? "Xem kết quả chính thức"
            : isUpcoming
            ? "Xem trước & bình chọn thử"
            : isOpen
            ? "Vào bình chọn ngay"
            : "Chờ ban tổ chức công bố kết quả"}
        </span>
        <span className="flex items-center gap-1 text-xs sm:text-label-md font-bold text-primary transition group-hover:translate-x-1">
          {isClosed ? "Xem kết quả" : isUpcoming ? "Thử ngay" : isOpen ? "Bình chọn" : "Xem"}
          <MaterialIcon name="arrow_forward" />
        </span>
      </div>
    </Link>
  );
}
