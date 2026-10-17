"use client";

import { useMemo } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollDetail, PollOption } from "@/lib/data/polls";
import { useAuth } from "@/components/auth/AuthProvider";

type Props = {
  poll: PollDetail;
};

export function PollPodiumResults({ poll }: Props) {
  const { isGuest } = useAuth();
  const isClosed = poll.status === "closed";

  // Guest can only see results when poll is closed
  const canSeeResults = isClosed || !isGuest;

  // Sort options by weightedScore desc (if poll has judges), then vote_count desc, order_num asc
  const sortedOptions = useMemo(() => {
    return [...poll.options].sort((a, b) => {
      if (poll.hasJudges) {
        const scoreA = a.weightedScore ?? 0;
        const scoreB = b.weightedScore ?? 0;
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
      }
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }
      return a.orderNum - b.orderNum;
    });
  }, [poll.options, poll.hasJudges]);

  if (!canSeeResults) {
    return (
      <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MaterialIcon className="text-[28px]" name="lock" />
        </div>
        <h3 className="text-title-md font-bold text-[#173A67]">Kết quả đang được cập nhật</h3>
        <p className="text-body-sm text-on-surface-variant max-w-md mx-auto mt-1">
          Chương trình đang mở bình chọn. Đoàn viên đăng nhập có thể theo dõi thứ hạng trực tiếp; khách có thể xem toàn bộ kết quả sau khi Ban Tổ chức đóng bình chọn.
        </p>
      </div>
    );
  }

  // Top 3 for Podium: 1st, 2nd, 3rd
  const top1 = sortedOptions[0];
  const top2 = sortedOptions[1];
  const top3 = sortedOptions[2];

  // Consolation prizes: 4th, 5th up to consolation_prize_count
  const consolationCount = poll.consolationPrizeCount || 2;
  const consolationOptions = sortedOptions.slice(3, 3 + consolationCount);

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-300/80 bg-surface-container-lowest shadow-sm">
      {/* Header Banner */}
      <div className="border-b border-amber-200/80 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <MaterialIcon className="text-[22px] sm:text-[26px] text-amber-600 shrink-0" name="emoji_events" />
            <div>
              <h2 className="text-base sm:text-title-lg font-black text-[#173A67] leading-snug">
                {isClosed ? "BẢNG KẾT QUẢ CHUNG CUỘC" : "BẢNG XẾP HẠNG THỨ HẠNG TRỰC TIẾP"}
              </h2>
              <p className="text-xs sm:text-label-sm text-on-surface-variant">
                {isClosed
                  ? "Chương trình đã kết thúc – Điểm số và các giải thưởng chính thức"
                  : "Cập nhật theo thứ hạng mới nhất (Điểm chi tiết và giải thưởng sẽ chốt khi đóng bình chọn)"}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-bold ${
              isClosed
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
            }`}
          >
            <span className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${isClosed ? "bg-emerald-600" : "bg-amber-600"}`} />
            {isClosed ? "Đã có kết quả chính thức" : "Đang bình chọn realtime"}
          </span>
        </div>

        {/* Banner thông báo tính điểm Ban Giám Khảo */}
        {poll.hasJudges && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 border border-amber-300/80 px-3 py-2 text-xs text-amber-950">
            <div className="flex items-center gap-1.5">
              <MaterialIcon className="text-[18px] text-amber-700" name="gavel" />
              <span>
                Tính điểm theo trọng số: <strong>Ban Giám Khảo ({poll.judgeWeightPercent ?? 30}%)</strong> +{" "}
                <strong>Bình chọn khác ({100 - (poll.judgeWeightPercent ?? 30)}%)</strong> (Thang 10 điểm).
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">
              Thực tế đã tham gia: <strong>{poll.totalJudgesVoted ?? 0}</strong> Giám khảo · <strong>{poll.totalOthersVoted ?? 0}</strong> người bình chọn khác
            </span>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-6 space-y-5 sm:space-y-8">
        {/* Podium: Bục trao giải 3 vị trí */}
        <div className="grid grid-cols-3 items-end gap-1.5 sm:gap-4 md:gap-6 pt-3 sm:pt-6 pb-1 text-center">
          {/* Hạng 2 (Bên trái) */}
          <div className="flex flex-col items-center">
            {top2 ? (
              <div className="w-full space-y-1 sm:space-y-2">
                <div className="relative mx-auto h-14 w-14 sm:h-20 sm:w-20 overflow-hidden rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-slate-100 shadow-xs">
                  {top2.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-full w-full object-cover" src={top2.imageUrls[0]} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-bold text-slate-500 text-xs sm:text-base">
                      #2
                    </div>
                  )}
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-slate-400 text-[10px] sm:text-xs font-black text-white shadow-xs">
                    2
                  </span>
                </div>
                <h4 className="line-clamp-1 sm:line-clamp-2 text-xs sm:text-label-md font-bold text-[#173A67] leading-tight">{top2.title}</h4>
                {top2.members.length > 0 ? (
                  <p className="line-clamp-1 text-[10px] sm:text-label-xs text-on-surface-variant">
                    {top2.members.map((m) => m.fullName).join(", ")}
                  </p>
                ) : null}
                {isClosed ? (
                  poll.hasJudges ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="inline-block rounded-full bg-slate-700 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-white shadow-2xs">
                        ⭐ {top2.weightedScore?.toFixed(2)} đ
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-slate-600 font-semibold">
                        BGK: {top2.judgeVotes ?? 0} · Khác: {top2.otherVotes ?? 0}
                      </span>
                    </div>
                  ) : (
                    <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] sm:text-xs font-extrabold text-slate-800">
                      {top2.voteCount} phiếu
                    </span>
                  )
                ) : null}
              </div>
            ) : null}
            <div className="mt-2 sm:mt-3 flex h-18 sm:h-28 w-full items-center justify-center rounded-t-xl sm:rounded-t-2xl border-t-4 border-slate-400 bg-gradient-to-t from-slate-200 to-slate-100 font-black text-slate-700 text-xs sm:text-base md:text-title-lg tracking-tight">
              GIẢI NHÌ
            </div>
          </div>

          {/* Hạng 1 (Chính giữa - Cao nhất) */}
          <div className="flex flex-col items-center -mt-4 sm:-mt-6">
            <MaterialIcon className="text-[28px] sm:text-[36px] text-amber-500 mb-0.5 sm:mb-1 animate-bounce" name="crown" />
            {top1 ? (
              <div className="w-full space-y-1 sm:space-y-2">
                <div className="relative mx-auto h-18 w-18 sm:h-24 sm:w-24 overflow-hidden rounded-xl sm:rounded-2xl border-2 sm:border-3 border-amber-400 bg-amber-50 shadow-md">
                  {top1.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-full w-full object-cover" src={top1.imageUrls[0]} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-bold text-amber-700 text-sm sm:text-lg">
                      #1
                    </div>
                  )}
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-amber-500 text-[10px] sm:text-sm font-black text-white shadow-md">
                    1
                  </span>
                </div>
                <h4 className="line-clamp-1 sm:line-clamp-2 text-xs sm:text-title-sm font-extrabold text-amber-950 leading-tight">{top1.title}</h4>
                {top1.members.length > 0 ? (
                  <p className="line-clamp-1 text-[10px] sm:text-label-xs font-semibold text-amber-800">
                    {top1.members.map((m) => m.fullName).join(", ")}
                  </p>
                ) : null}
                {isClosed ? (
                  poll.hasJudges ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="inline-block rounded-full bg-amber-500 px-3 py-0.5 text-[10px] sm:text-xs font-black text-white shadow-xs">
                        🏆 {top1.weightedScore?.toFixed(2)} đ (Vô địch)
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-amber-900 font-bold">
                        BGK: {top1.judgeVotes ?? 0} · Khác: {top1.otherVotes ?? 0}
                      </span>
                    </div>
                  ) : (
                    <span className="inline-block rounded-full bg-amber-400 px-2 sm:px-3 py-0.5 text-[10px] sm:text-xs font-black text-amber-950 shadow-2xs">
                      {top1.voteCount} phiếu (Vô địch)
                    </span>
                  )
                ) : null}
              </div>
            ) : null}
            <div className="mt-2 sm:mt-3 flex h-26 sm:h-36 w-full items-center justify-center rounded-t-xl sm:rounded-t-2xl border-t-4 border-amber-500 bg-gradient-to-t from-amber-300 to-amber-200 font-black text-amber-950 text-sm sm:text-lg md:text-title-xl shadow-xs tracking-tight">
              GIẢI NHẤT
            </div>
          </div>

          {/* Hạng 3 (Bên phải) */}
          <div className="flex flex-col items-center">
            {top3 ? (
              <div className="w-full space-y-1 sm:space-y-2">
                <div className="relative mx-auto h-14 w-14 sm:h-20 sm:w-20 overflow-hidden rounded-xl sm:rounded-2xl border-2 border-amber-700/40 bg-amber-100/50 shadow-xs">
                  {top3.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-full w-full object-cover" src={top3.imageUrls[0]} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-bold text-amber-800 text-xs sm:text-base">
                      #3
                    </div>
                  )}
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-amber-700 text-[10px] sm:text-xs font-black text-white shadow-xs">
                    3
                  </span>
                </div>
                <h4 className="line-clamp-1 sm:line-clamp-2 text-xs sm:text-label-md font-bold text-[#173A67] leading-tight">{top3.title}</h4>
                {top3.members.length > 0 ? (
                  <p className="line-clamp-1 text-[10px] sm:text-label-xs text-on-surface-variant">
                    {top3.members.map((m) => m.fullName).join(", ")}
                  </p>
                ) : null}
                {isClosed ? (
                  poll.hasJudges ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="inline-block rounded-full bg-amber-800 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-white shadow-2xs">
                        ⭐ {top3.weightedScore?.toFixed(2)} đ
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-amber-900 font-semibold">
                        BGK: {top3.judgeVotes ?? 0} · Khác: {top3.otherVotes ?? 0}
                      </span>
                    </div>
                  ) : (
                    <span className="inline-block rounded-full bg-amber-200 px-2 py-0.5 text-[10px] sm:text-xs font-extrabold text-amber-900">
                      {top3.voteCount} phiếu
                    </span>
                  )
                ) : null}
              </div>
            ) : null}
            <div className="mt-2 sm:mt-3 flex h-16 sm:h-24 w-full items-center justify-center rounded-t-xl sm:rounded-t-2xl border-t-4 border-amber-700 bg-gradient-to-t from-amber-200/80 to-amber-100 font-black text-amber-900 text-xs sm:text-base md:text-title-lg tracking-tight">
              GIẢI BA
            </div>
          </div>
        </div>

        {/* Giải khuyến khích (Hiển thị 2 giải khuyến khích) */}
        {consolationOptions.length > 0 ? (
          <div className="border-t border-outline-variant/60 pt-5 space-y-3">
            <h4 className="text-label-lg font-bold text-[#173A67] flex items-center gap-2">
              <MaterialIcon className="text-primary text-[20px]" name="workspace_premium" />
              <span>Giải Khuyến Khích ({consolationOptions.length} giải)</span>
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {consolationOptions.map((opt, idx) => (
                <div
                  key={opt.id}
                  className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-low p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-on-surface-variant">
                      #{idx + 4}
                    </span>
                    <div>
                      <p className="font-bold text-[#173A67] text-body-md line-clamp-1">{opt.title}</p>
                      {opt.members.length > 0 ? (
                        <p className="text-label-xs text-on-surface-variant line-clamp-1">
                          {opt.members.map((m) => m.fullName).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {isClosed ? (
                    poll.hasJudges ? (
                      <div className="text-right">
                        <span className="rounded-lg bg-[#173A67] px-2.5 py-1 text-xs font-bold text-white shadow-2xs">
                          ⭐ {opt.weightedScore?.toFixed(2)} đ
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          BGK: {opt.judgeVotes ?? 0} · Khác: {opt.otherVotes ?? 0}
                        </p>
                      </div>
                    ) : (
                      <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-primary border border-outline-variant shrink-0">
                        {opt.voteCount} phiếu
                      </span>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Người dự đoán gần đúng nhất (nếu chương trình đã kết thúc và có dự đoán) */}
        {isClosed && poll.winningPredictorInfo ? (
          <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/70 p-5 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-900">
              <MaterialIcon className="text-[24px] text-emerald-600" name="stars" />
              <h4 className="text-title-md font-extrabold">Người Dự Đoán Gần Đúng Nhất</h4>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-headline-sm font-extrabold text-emerald-950">
                  {poll.winningPredictorInfo.fullName || "Đoàn viên chiến thắng"}
                </p>
                <p className="text-body-sm text-emerald-900 mt-0.5">
                  Dự đoán: <strong>{poll.winningPredictorInfo.predictedCount}</strong> người · Thực tế giải Nhất: <strong>{poll.winningPredictorInfo.actualCount}</strong> người (Lệch: {poll.winningPredictorInfo.diff})
                </p>
              </div>
              <span className="rounded-xl bg-emerald-600 px-4 py-2 font-black text-white text-sm shadow-xs">
                +{poll.predictorRewardPoints} điểm thưởng
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
