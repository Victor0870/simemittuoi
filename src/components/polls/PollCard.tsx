import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollSummary } from "@/lib/data/polls";

type Props = {
  poll: PollSummary;
};

export function PollCard({ poll }: Props) {
  const isClosed = poll.status === "closed";
  const isOpen = poll.status === "open";

  return (
    <Link
      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xs transition hover:border-primary hover:shadow-md"
      href={`/polls/${poll.id}`}
    >
      <div>
        {/* Badges */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-label-xs font-bold ${
                isOpen
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isOpen ? "bg-emerald-600 animate-pulse" : "bg-slate-400"
                }`}
              />
              {isOpen ? "Đang mở bình chọn" : "Đã kết thúc"}
            </span>

            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-label-xs font-semibold text-primary">
              {poll.pollType === "vote" ? "Bình chọn / Vote" : "Trả lời câu hỏi"}
            </span>

            <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-label-xs font-semibold text-on-surface-variant">
              {poll.accessType === "free" ? "Công khai (Free)" : "Đoàn viên"}
            </span>
          </div>

          <span className="text-label-xs text-on-surface-variant">
            {new Date(poll.createdAt).toLocaleDateString("vi-VN")}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-title-lg font-bold text-[#173A67] transition group-hover:text-primary">
          {poll.title}
        </h3>

        {/* Description */}
        {poll.description ? (
          <p className="mt-2 text-body-md text-on-surface-variant line-clamp-2">
            {poll.description}
          </p>
        ) : null}

        {/* Features badges */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-label-xs text-[#27496D]">
          <span className="flex items-center gap-1">
            <MaterialIcon className="text-[16px] text-amber-600" name="how_to_vote" />
            Vote tối đa {poll.maxVotesPerUser} tác phẩm
          </span>
          {poll.hasPrediction ? (
            <span className="flex items-center gap-1">
              <MaterialIcon className="text-[16px] text-emerald-600" name="stars" />
              Có dự đoán trúng thưởng (+{poll.predictorRewardPoints}đ)
            </span>
          ) : null}
          {poll.voterRewardPoints > 0 ? (
            <span className="flex items-center gap-1">
              <MaterialIcon className="text-[16px] text-primary" name="card_giftcard" />
              Thưởng tham gia +{poll.voterRewardPoints}đ
            </span>
          ) : null}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-6 flex items-center justify-between border-t border-outline-variant/60 pt-4">
        <span className="text-label-sm font-semibold text-on-surface-variant">
          {isClosed ? "Xem kết quả chính thức" : "Vào bình chọn ngay"}
        </span>
        <span className="flex items-center gap-1 text-label-md font-bold text-primary transition group-hover:translate-x-1">
          {isClosed ? "Xem kết quả" : "Bình chọn"}
          <MaterialIcon name="arrow_forward" />
        </span>
      </div>
    </Link>
  );
}
