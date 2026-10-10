import Link from "next/link";
import { notFound } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getPollById } from "@/lib/data/polls";
import { PollPodiumResults } from "@/components/polls/PollPodiumResults";
import { PollVotingSection } from "@/components/polls/PollVotingSection";

export const revalidate = 15;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PollDetailPage({ params }: Props) {
  const { id } = await params;
  const poll = await getPollById(id);

  if (!poll) notFound();

  const isClosed = poll.status === "closed";

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
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

      {/* Main Header Card */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                !isClosed
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  !isClosed ? "bg-emerald-600 animate-pulse" : "bg-slate-400"
                }`}
              />
              {!isClosed ? "Đang mở bình chọn" : "Đã kết thúc"}
            </span>

            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {poll.pollType === "vote" ? "Bình chọn / Vote tác phẩm" : "Trả lời câu hỏi trắc nghiệm"}
            </span>

            <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface-variant">
              {poll.accessType === "free" ? "Bình chọn tự do (Free)" : "Dành riêng cho đoàn viên"}
            </span>
          </div>

          <span className="text-body-sm text-on-surface-variant">
            Ngày mở: {new Date(poll.createdAt).toLocaleDateString("vi-VN")}
          </span>
        </div>

        <h1 className="text-headline-md sm:text-headline-lg font-extrabold text-[#173A67] tracking-tight">
          {poll.title}
        </h1>

        {poll.description ? (
          <p className="text-body-lg text-on-surface-variant leading-relaxed">
            {poll.description}
          </p>
        ) : null}

        {/* Reward info chips */}
        <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/60 pt-4 text-body-sm text-[#27496D]">
          <span className="flex items-center gap-1.5 rounded-lg bg-surface-container-low px-3 py-1 font-semibold">
            <MaterialIcon className="text-[18px] text-amber-600" name="how_to_vote" />
            Được chọn tối đa: <strong>{poll.maxVotesPerUser} tác phẩm</strong>
          </span>
          {poll.hasPrediction ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1 font-semibold text-emerald-900 border border-emerald-200">
              <MaterialIcon className="text-[18px] text-emerald-600" name="stars" />
              Thưởng dự đoán đúng: <strong>+{poll.predictorRewardPoints} điểm</strong>
            </span>
          ) : null}
          {poll.voterRewardPoints > 0 ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1 font-semibold text-primary">
              <MaterialIcon className="text-[18px]" name="card_giftcard" />
              Thưởng tham gia vote: <strong>+{poll.voterRewardPoints} điểm</strong>
            </span>
          ) : null}
        </div>
      </div>

      {/* 1. KẾT QUẢ HIỂN THỊ TRÊN ĐẦU (Theo yêu cầu) */}
      <section className="space-y-3">
        <PollPodiumResults poll={poll} />
      </section>

      {/* 2. KHU VỰC BÌNH CHỌN / BẦU CHỌN TÁC PHẨM */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8 shadow-xs">
        <PollVotingSection poll={poll} />
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
