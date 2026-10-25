"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatPollTime, type PollPhaseInput } from "@/lib/polls/phase";
import { usePollPhase } from "@/components/polls/usePollPhase";
import { PollCountdown } from "@/components/polls/PollCountdown";

type Props = {
  poll: PollPhaseInput;
  initialNow: number;
};

export function PollScheduleNotice({ poll, initialNow }: Props) {
  const phase = usePollPhase(poll, initialNow);

  if (phase === "upcoming") {
    return (
      <div className="rounded-2xl border-2 border-sky-300 bg-linear-to-br from-sky-50 to-white p-4 sm:p-6 shadow-xs space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-xs">
              <MaterialIcon className="text-[24px]" name="schedule" />
            </span>
            <div>
              <h2 className="text-base sm:text-title-lg font-extrabold text-sky-950">
                Chương trình sắp mở bình chọn
              </h2>
              <p className="text-xs sm:text-body-sm text-sky-900/80 mt-0.5">
                {poll.opensAt
                  ? `Mở nhận phiếu lúc ${formatPollTime(poll.opensAt)}`
                  : "Ban tổ chức sẽ mở nhận phiếu trong thời gian tới"}
                {poll.votingEndsAt ? ` · dừng nhận phiếu lúc ${formatPollTime(poll.votingEndsAt)}` : ""}
              </p>
            </div>
          </div>
          {poll.opensAt ? (
            <div className="rounded-xl bg-sky-600 px-3.5 py-2 text-center text-white shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-100">Còn lại</p>
              <PollCountdown className="block text-lg sm:text-xl font-black tabular-nums" target={poll.opensAt} />
            </div>
          ) : null}
        </div>

        <ol className="grid gap-2 sm:grid-cols-3 text-xs sm:text-sm text-sky-950">
          <li className="flex items-start gap-2 rounded-xl bg-white/80 border border-sky-200 p-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-black text-white">1</span>
            <span>Xem các bài thi, bấm vào ảnh để phóng to.</span>
          </li>
          <li className="flex items-start gap-2 rounded-xl bg-white/80 border border-sky-200 p-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-black text-white">2</span>
            <span>Bấm &quot;Bình chọn bài thi này&quot; cho bài thi bạn thích.</span>
          </li>
          <li className="flex items-start gap-2 rounded-xl bg-white/80 border border-sky-200 p-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-black text-white">3</span>
            <span>Điền thông tin ở khung cuối trang rồi bấm gửi phiếu.</span>
          </li>
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-sky-900">
            Bạn có thể bình chọn thử ngay bây giờ để làm quen. Phiếu thử không được ghi nhận.
          </p>
          <a
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-sky-700 transition"
            href="#binh-chon"
          >
            <MaterialIcon className="text-[18px]" name="touch_app" />
            Bình chọn thử ngay
          </a>
        </div>
      </div>
    );
  }

  if (phase === "open" && poll.votingEndsAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center gap-2.5 text-emerald-950">
          <MaterialIcon className="text-[24px] text-emerald-600" name="timer" />
          <p className="text-sm font-bold">
            Đang nhận phiếu đến {formatPollTime(poll.votingEndsAt)}
          </p>
        </div>
        <span className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-black text-white tabular-nums">
          Còn <PollCountdown target={poll.votingEndsAt} />
        </span>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3.5 sm:p-4 text-amber-950 shadow-xs">
        <MaterialIcon className="text-[24px] text-amber-600" name="hourglass_bottom" />
        <p className="text-sm font-bold">
          Đã hết giờ nhận phiếu. Kết quả sẽ được ban tổ chức công bố sau.
        </p>
      </div>
    );
  }

  return null;
}
