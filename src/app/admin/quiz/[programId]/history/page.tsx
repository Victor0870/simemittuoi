import Link from "next/link";
import { AdminQuizAttempts } from "@/components/admin/AdminQuizAttempts";
import { QuizLeaderboard } from "@/components/quiz/QuizLeaderboard";
import { computeSessionRanking } from "@/lib/quiz";
import { formatQuizDate, formatQuizTime, type QuizSessionRow } from "@/lib/quiz-shared";
import { QuizTabs, quizProgramHref } from "../../QuizTabs";
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
  const { settings, currentSession, sessions, sessionsError, displaySession } = await loadQuizData(db, program.id);
  const { round } = await searchParams;

  const rounds = (sessions ?? []) as QuizSessionRow[];
  const requested = typeof round === "string" ? rounds.find((s) => s.id === round) : undefined;
  const selectedId = requested?.id ?? displaySession?.id ?? rounds[0]?.id;
  const selected =
    rounds.find((s) => s.id === selectedId) ?? (displaySession?.id === selectedId ? displaySession : null);
  const board = selected ? await computeSessionRanking(db, selected.id, settings) : null;

  return (
    <div className="space-y-8 pb-10">
      <QuizTabs active="history" programId={program.id} sessionsError={sessionsError?.message ?? null} />

      <section className="space-y-3">
        <h2 className="text-title-md font-bold text-[#173A67]">Các đợt thi gần đây</h2>
        {rounds.length === 0 ? (
          <p className="rounded-2xl border border-[#d2dfe9] bg-white p-5 text-sm text-on-surface-variant">
            Chưa có đợt thi nào.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rounds.map((s) => {
              const isSelected = s.id === selected?.id;
              const status = s.finalized_at
                ? { label: "Đã tổng kết", className: "bg-[#D9F2EC] text-[#173A67]" }
                : currentSession?.id === s.id
                  ? { label: "Đang mở", className: "bg-amber-100 text-amber-900" }
                  : { label: "Chưa tổng kết", className: "bg-surface-container text-on-surface-variant" };
              return (
                <li key={s.id}>
                  <Link
                    aria-current={isSelected ? "true" : undefined}
                    className={`block rounded-xl border p-3 text-sm transition ${
                      isSelected
                        ? "border-[#4a6b82] bg-[#ecf4ff] shadow-sm ring-1 ring-[#4a6b82]"
                        : "border-[#d2dfe9] bg-white hover:border-[#4a6b82] hover:bg-[#f7fafd]"
                    }`}
                    href={`${quizProgramHref(program.id, "history")}?round=${encodeURIComponent(s.id)}`}
                    scroll={false}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[#173A67]">{s.title}</p>
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">{formatRange(s.starts_at, s.ends_at)}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {s.participants_count ?? 0} người tham gia
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
