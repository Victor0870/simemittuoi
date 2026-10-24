"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  isAdmin?: boolean;
  sessionId?: string;
  /** Trang quản trị: tiêu đề một dòng, bảng xếp hạng dạng lưới thẻ nhỏ, chiều cao giới hạn. */
  compact?: boolean;
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
  isAdmin,
  sessionId,
  compact = false,
}: Props) {
  const router = useRouter();
  const [busyUser, setBusyUser] = useState<string | null>(null);

  async function handleDeleteUserResult(userId: string, fullName: string) {
    if (!sessionId) return;
    if (
      !window.confirm(
        `Xác nhận xóa kết quả đợt thi của đoàn viên "${fullName}"? (Lượt làm bài sẽ bị xóa khỏi hệ thống và thu hồi điểm nếu đã tổng kết)`,
      )
    ) {
      return;
    }
    setBusyUser(userId);
    try {
      const res = await fetch(`/api/quiz/attempts?sessionId=${sessionId}&userId=${userId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể xóa kết quả.");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể xóa kết quả.");
    } finally {
      setBusyUser(null);
    }
  }
  const resultLink = resultPostId ? (
    <Link
      className={`inline-flex items-center gap-1 font-bold text-primary hover:underline ${compact ? "text-xs" : "mt-4 text-sm"}`}
      href={`/posts/${resultPostId}`}
    >
      Xem bài viết kết quả
      <MaterialIcon className={compact ? "text-[16px]" : "text-[18px]"} name="arrow_forward" />
    </Link>
  ) : null;

  return (
    <section
      className={
        compact
          ? "shrink-0 rounded-xl border border-dusty-border/80 bg-white p-3 shadow-xs"
          : "rounded-2xl border border-dusty-border/80 bg-white p-4 shadow-xs sm:p-6"
      }
      id="quiz-leaderboard"
    >
      <div
        className={
          compact
            ? "mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
            : "mb-4 flex flex-wrap items-start justify-between gap-3"
        }
      >
        <div className={compact ? "flex min-w-0 flex-wrap items-baseline gap-x-2" : undefined}>
          <h2 className={`flex items-center gap-2 font-bold text-[#173A67] ${compact ? "text-sm" : "text-title-md"}`}>
            <MaterialIcon className={`${compact ? "text-[20px]" : "text-[22px]"} text-amber-500`} name="emoji_events" />
            Bảng xếp hạng
          </h2>
          <p className="text-xs text-on-surface-variant">
            {title} · {participantsCount} người tham gia · Chỉ người đúng cả {totalQuestions} câu được
            xếp hạng
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {compact ? resultLink : null}
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
      </div>

      {ranking.length === 0 ? (
        <p
          className={`bg-surface-container-low text-center text-on-surface-variant ${
            compact ? "rounded-lg px-3 py-2 text-xs" : "rounded-xl px-4 py-6 text-sm"
          }`}
        >
          Chưa có ai trả lời đúng cả {totalQuestions} câu.
        </p>
      ) : compact ? (
        <ol className="grid gap-1.5 sm:grid-cols-2 lg:max-h-[100px] lg:grid-cols-3 lg:overflow-y-auto xl:grid-cols-4">
          {ranking.map((r) => (
            <li
              key={r.user_id}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-dusty-border/60 px-2 py-1.5"
              title={`${r.full_name} · ${r.department ?? "—"} · bắt đầu ${formatQuizTime(r.started_at)}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  MEDAL_CLASS[r.rank - 1] ?? "bg-surface-container text-[#173A67]"
                }`}
              >
                {r.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-on-surface">{r.full_name}</p>
                <p className="truncate text-[11px] text-on-surface-variant">
                  <span className="font-semibold text-[#173A67]">{formatQuizDuration(r.duration_ms)}</span>
                  {" · "}
                  <span className="font-semibold text-amber-700">
                    +{r.points}đ{finalized ? "" : " (dự kiến)"}
                  </span>
                </p>
              </div>
              {isAdmin && sessionId ? (
                <button
                  type="button"
                  disabled={busyUser === r.user_id}
                  onClick={() => void handleDeleteUserResult(r.user_id, r.full_name)}
                  title={`Xóa kết quả thi của ${r.full_name}`}
                  className="shrink-0 rounded-lg p-1 text-on-surface-variant/40 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  {busyUser === r.user_id ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                  ) : (
                    <MaterialIcon className="text-[16px]" name="delete_forever" />
                  )}
                </button>
              ) : null}
            </li>
          ))}
        </ol>
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
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#173A67]">{formatQuizDuration(r.duration_ms)}</p>
                    <p className="text-xs font-semibold text-amber-700">
                      +{r.points} điểm{finalized ? "" : " (dự kiến)"}
                    </p>
                  </div>
                  {isAdmin && sessionId ? (
                    <button
                      type="button"
                      disabled={busyUser === r.user_id}
                      onClick={() => void handleDeleteUserResult(r.user_id, r.full_name)}
                      title={`Xóa kết quả thi của ${r.full_name}`}
                      className="rounded-lg p-1.5 text-on-surface-variant/40 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      {busyUser === r.user_id ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                      ) : (
                        <MaterialIcon className="text-[18px]" name="delete_forever" />
                      )}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {compact ? null : resultLink}
    </section>
  );
}
