import Link from "next/link";
import { AdminQuizAttempts } from "@/components/admin/AdminQuizAttempts";
import { QuizLeaderboard } from "@/components/quiz/QuizLeaderboard";
import { computeSessionRanking } from "@/lib/quiz";
import { formatQuizDate, formatQuizTime, type QuizSessionRow } from "@/lib/quiz-shared";
import { QUIZ_COMPACT_PAGE, QuizTabs, quizProgramHref } from "../../QuizTabs";
import { loadQuizData, requireQuizProgramPage } from "../../loadQuizData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatRange(startsAt: string, endsAt: string) {
  return `${formatQuizTime(startsAt)} ${formatQuizDate(startsAt)} – ${formatQuizTime(endsAt)} ${formatQuizDate(endsAt)}`;
}

export default async function AdminQuizHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const { programId } = await params;
  const { db, program } = await requireQuizProgramPage(programId, "history");
  const { settings, currentSession, sessions, sessionsError, displaySession } = await loadQuizData(db, program);
  const { round } = await searchParams;

  const rounds = (sessions ?? []) as QuizSessionRow[];
  const requested = typeof round === "string" ? rounds.find((s) => s.id === round) : undefined;
  const selectedId = requested?.id ?? displaySession?.id ?? rounds[0]?.id;
  const selected =
    rounds.find((s) => s.id === selectedId) ?? (displaySession?.id === selectedId ? displaySession : null);
  const board = selected ? await computeSessionRanking(db, selected.id, settings) : null;

  return (
    <div className={QUIZ_COMPACT_PAGE}>
      <QuizTabs active="history" program={program} sessionsError={sessionsError?.message ?? null} />

      <section aria-label="Các đợt thi gần đây" className="shrink-0">
        {rounds.length === 0 ? (
          <p className="rounded-xl border border-[#d2dfe9] bg-white px-3 py-2 text-sm text-on-surface-variant">
            Chưa có đợt thi nào.
          </p>
        ) : (
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {rounds.map((s) => {
              const isSelected = s.id === selected?.id;
              const status = s.finalized_at
                ? { label: "Đã tổng kết", className: "bg-[#D9F2EC] text-[#173A67]" }
                : currentSession?.id === s.id
                  ? { label: "Đang mở", className: "bg-amber-100 text-amber-900" }
                  : { label: "Chưa tổng kết", className: "bg-surface-container text-on-surface-variant" };
              return (
                <li key={s.id} className="w-64 shrink-0">
                  <Link
                    aria-current={isSelected ? "true" : undefined}
                    className={`block rounded-xl border px-2.5 py-1.5 text-xs transition ${
                      isSelected
                        ? "border-[#4a6b82] bg-[#ecf4ff] shadow-sm ring-1 ring-[#4a6b82]"
                        : "border-[#d2dfe9] bg-white hover:border-[#4a6b82] hover:bg-[#f7fafd]"
                    }`}
                    href={`${quizProgramHref(program.id, "history")}?round=${encodeURIComponent(s.id)}`}
                    scroll={false}
                    title={s.title}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[#173A67]">{s.title}</p>
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-on-surface-variant">
                      {formatRange(s.starts_at, s.ends_at)} · {s.participants_count ?? 0} người tham gia
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected && board ? (
        <QuizLeaderboard
          compact
          finalized={Boolean(selected.finalized_at)}
          isOpen={currentSession?.id === selected.id}
          participantsCount={board.participantsCount}
          ranking={board.ranking}
          resultPostId={selected.result_post_id}
          title={selected.title}
          totalQuestions={settings.questions_per_attempt}
          isAdmin={true}
          sessionId={selected.id}
        />
      ) : null}

      <AdminQuizAttempts key={selectedId} sessions={rounds} initialSessionId={selectedId} />
    </div>
  );
}
