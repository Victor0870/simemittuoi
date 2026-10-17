import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatQuizDuration, formatQuizTime, type QuizRankingRow } from "@/lib/quiz-shared";

type Props = {
  title: string;
  ranking: QuizRankingRow[];
  finalized: boolean;
  isOpen: boolean;
  totalQuestions: number;
  participantsCount: number;
  resultPostId?: string | null;
  currentUserId?: string | null;
};

const MEDAL_CLASS = [
  "bg-amber-400 text-white",
  "bg-slate-400 text-white",
  "bg-orange-400 text-white",
];

export function QuizLeaderboard({
  title,
  ranking,
  finalized,
  isOpen,
  totalQuestions,
  participantsCount,
  resultPostId,
  currentUserId,
}: Props) {
  return (
    <section
      className="rounded-2xl border border-dusty-border/80 bg-white p-4 shadow-xs sm:p-6"
      id="quiz-leaderboard"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-title-md font-bold text-[#173A67]">
            <MaterialIcon className="text-[22px] text-amber-500" name="emoji_events" />
            Bảng xếp hạng
          </h2>
          <p className="text-xs text-on-surface-variant">
            {title} · {participantsCount} người tham gia · Chỉ người đúng cả {totalQuestions} câu được
            xếp hạng
          </p>
        </div>
        {isOpen ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Đang diễn ra
          </span>
        ) : finalized ? (
          <span className="rounded-full bg-[#D9F2EC] px-2.5 py-0.5 text-xs font-bold text-[#173A67]">
            Đã tổng kết & cộng điểm
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            Chờ tổng kết
          </span>
        )}
      </div>

      {ranking.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">
          Chưa có ai trả lời đúng cả {totalQuestions} câu.
        </p>
      ) : (
        <ol className="divide-y divide-dusty-border/60">
          {ranking.map((r) => {
            const isMe = currentUserId === r.user_id;
            return (
              <li
                key={r.user_id}
                className={`flex items-center gap-3 py-2.5 ${isMe ? "rounded-xl bg-primary/[0.06] px-2" : ""}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    MEDAL_CLASS[r.rank - 1] ?? "bg-surface-container text-[#173A67]"
                  }`}
                >
                  {r.rank}
                </span>
                {r.avatar_url ? (
                  <img
                    alt={r.full_name}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                    src={r.avatar_url}
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dusty-light text-sm font-bold text-primary">
                    {r.full_name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-on-surface">
                    {r.full_name}
                    {isMe ? <span className="ml-1 text-xs font-semibold text-primary">(Bạn)</span> : null}
                  </p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {r.department ?? "—"} · bắt đầu {formatQuizTime(r.started_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#173A67]">{formatQuizDuration(r.duration_ms)}</p>
                  <p className="text-xs font-semibold text-amber-700">
                    +{r.points} điểm{finalized ? "" : " (dự kiến)"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {resultPostId ? (
        <Link
          className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
          href={`/posts/${resultPostId}`}
        >
          Xem bài viết kết quả
          <MaterialIcon className="text-[18px]" name="arrow_forward" />
        </Link>
      ) : null}
    </section>
  );
}
