import Link from "next/link";
import { notFound } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getPollById } from "@/lib/data/polls";
import { PollPodiumResults } from "@/components/polls/PollPodiumResults";
import { PollVotingSection } from "@/components/polls/PollVotingSection";
import { PollPointsVotingSection } from "@/components/polls/PollPointsVotingSection";
import { PollEntrySubmissionSection } from "@/components/polls/PollEntrySubmissionSection";
import { AdminShortcutLink } from "@/components/admin/AdminShortcutLink";
import { PollQrButton } from "@/components/polls/PollQrButton";
import { PollPhaseBadge } from "@/components/polls/PollPhaseBadge";
import { formatPollTime } from "@/lib/polls/phase";
import { PollScheduleNotice } from "@/components/polls/PollScheduleNotice";
import { toPublicPollView } from "@/lib/polls/entry-view";

export const revalidate = 120;

// Không dựng sẵn lúc build; mỗi poll được render lần đầu khi có người mở rồi cache chung (ISR).
export async function generateStaticParams() {
  return [];
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PollDetailPage({ params }: Props) {
  const { id } = await params;
  const fullPoll = await getPollById(id);

  if (!fullPoll) notFound();

  const poll = toPublicPollView(fullPoll);

  const now = Date.now();

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
        <AdminShortcutLink className="order-last ml-auto" href={`/admin/polls/${poll.id}`} label="Quản lý chương trình" />
        <Link className="hover:text-primary" href="/">
          Trang chủ
        </Link>
        <MaterialIcon className="text-[14px]" name="chevron_right" />
        <Link className="hover:text-primary" href="/polls">
          Bình chọn
        </Link>
        <MaterialIcon className="text-[14px]" name="chevron_right" />
        <span className="line-clamp-1 text-on-surface font-semibold">{poll.title}</span>
      </nav>

      {/* Inactive Notice Banner */}
      {!poll.isActive ? (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5 text-amber-950 shadow-xs flex items-start gap-3">
          <MaterialIcon className="text-[26px] text-amber-600 shrink-0 mt-0.5" name="pause_circle" />
          <div className="space-y-1">
            <h3 className="text-title-sm sm:text-title-md font-bold text-amber-900">
              Chương trình bình chọn đang tạm ngưng (Inactive)
            </h3>
            <p className="text-xs sm:text-body-sm text-amber-800 leading-relaxed">
              Ban Chấp hành Công đoàn đang tạm ẩn hoặc bảo trì chương trình này. Người dùng hiện chưa thể gửi phiếu bình chọn. Vui lòng quay lại sau!
            </p>
          </div>
        </div>
      ) : null}

      {/* Main Header Card */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-8 shadow-xs space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {!poll.isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-bold text-slate-700">
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-slate-500" />
                Tạm ngưng (Inactive)
              </span>
            ) : null}

            <PollPhaseBadge initialNow={now} poll={poll} />

            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold text-primary">
              {poll.pollType === "vote" ? "Bình chọn bài thi" : "Câu hỏi trắc nghiệm"}
            </span>

            <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold text-on-surface-variant">
              {poll.accessType === "free" ? "Công khai (Free)" : "Đoàn viên"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PollQrButton pollId={poll.id} pollTitle={poll.title} />
            <span className="text-xs sm:text-body-sm text-on-surface-variant">
              {poll.opensAt
                ? `Mở bình chọn: ${formatPollTime(poll.opensAt)}`
                : `Ngày mở: ${new Date(poll.createdAt).toLocaleDateString("vi-VN")}`}
            </span>
          </div>
        </div>

        <h1 className="text-xl sm:text-headline-md md:text-headline-lg font-extrabold text-[#173A67] tracking-tight leading-tight">
          {poll.title}
        </h1>

        {poll.description ? (
          <p className="text-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
            {poll.description}
          </p>
        ) : null}

        {/* Reward info chips */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t border-outline-variant/60 pt-3 sm:pt-4 text-xs sm:text-body-sm text-[#27496D]">
          {poll.voteMode === "points" ? (
            <span className="flex items-center gap-1 sm:gap-1.5 rounded-lg bg-surface-container-low px-2.5 py-1 font-semibold">
              <MaterialIcon className="text-[16px] sm:text-[18px] text-amber-600" name="scoreboard" />
              Vote theo point:{" "}
              <strong>
                {poll.pointsPerParticipant} điểm/người dự thi · {poll.pointsPerNonParticipant} điểm/người không dự thi
              </strong>
            </span>
          ) : (
            <span className="flex items-center gap-1 sm:gap-1.5 rounded-lg bg-surface-container-low px-2.5 py-1 font-semibold">
              <MaterialIcon className="text-[16px] sm:text-[18px] text-amber-600" name="how_to_vote" />
              Được chọn tối đa: <strong>{poll.maxVotesPerUser} bài thi</strong>
            </span>
          )}
          {poll.submissionMode === "player" ? (
            <span className="flex items-center gap-1 sm:gap-1.5 rounded-lg bg-surface-container-low px-2.5 py-1 font-semibold">
              <MaterialIcon className="text-[16px] sm:text-[18px] text-amber-600" name="upload_file" />
              Người chơi nộp bài
              {poll.submissionDeadline ? (
                <>
                  : hạn <strong>{formatPollTime(poll.submissionDeadline)}</strong>
                </>
              ) : null}
            </span>
          ) : null}
          {poll.hasPrediction ? (
            <span className="flex items-center gap-1 sm:gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-900 border border-emerald-200">
              <MaterialIcon className="text-[16px] sm:text-[18px] text-emerald-600" name="stars" />
              Thưởng dự đoán: <strong>+{poll.predictorRewardPoints} điểm</strong>
            </span>
          ) : null}
          {poll.voterRewardPoints > 0 ? (
            <span className="flex items-center gap-1 sm:gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 font-semibold text-primary">
              <MaterialIcon className="text-[16px] sm:text-[18px]" name="card_giftcard" />
              Thưởng tham gia: <strong>+{poll.voterRewardPoints} điểm</strong>
            </span>
          ) : null}
        </div>
      </div>

      <PollScheduleNotice initialNow={now} poll={poll} />

      {poll.submissionMode === "player" ? <PollEntrySubmissionSection initialNow={now} poll={poll} /> : null}

      {/* 1. KẾT QUẢ HIỂN THỊ TRÊN ĐẦU (Theo yêu cầu) */}
      <PollPodiumResults initialNow={now} poll={poll} />

      {/* 2. KHU VỰC BÌNH CHỌN / BẦU CHỌN TÁC PHẨM */}
      <section
        className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-8 shadow-xs scroll-mt-20"
        id="binh-chon"
      >
        {poll.voteMode === "points" ? (
          <PollPointsVotingSection initialNow={now} poll={poll} />
        ) : (
          <PollVotingSection initialNow={now} poll={poll} />
        )}
      </section>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between border-t border-outline-variant/60 pt-6">
        <Link
          className="inline-flex items-center gap-1.5 text-label-md font-bold text-primary hover:underline"
          href="/polls"
        >
          <MaterialIcon name="arrow_back" />
          <span>Tất cả chương trình bình chọn</span>
        </Link>
        <Link
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary px-4 py-2 text-label-md font-bold text-primary hover:bg-primary hover:text-white transition"
          href="/"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
