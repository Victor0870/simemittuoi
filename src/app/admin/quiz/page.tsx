import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminQuizControl } from "@/components/admin/AdminQuizControl";
import { AdminQuizQuestions } from "@/components/admin/AdminQuizQuestions";
import { QuizLeaderboard } from "@/components/quiz/QuizLeaderboard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  computeSessionRanking,
  ensureCurrentSession,
  finalizeDueSessions,
  getDisplaySession,
  loadQuizSettings,
  nextAutoStart,
  selectAllRows,
} from "@/lib/quiz";
import type { QuizQuestionRow, QuizSessionRow } from "@/lib/quiz-shared";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuizPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/quiz");
  }

  const { data: me } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  const db = createServiceClient();
  const now = new Date();
  const settings = await loadQuizSettings(db);
  try {
    await finalizeDueSessions(db, settings, now);
  } catch (err) {
    console.error("[admin/quiz] auto finalize error:", err);
  }
  const currentSession = await ensureCurrentSession(db, settings, now);

  const [questions, { data: sessions, error: sessionsError }, displaySession] = await Promise.all([
    selectAllRows<QuizQuestionRow>((from, to) =>
      db
        .from(CDILV_TABLE.quizQuestions)
        .select("id, content, option_1, option_2, option_3, option_4, correct_option, created_at")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    db
      .from(CDILV_TABLE.quizSessions)
      .select(
        "id, session_key, title, mode, starts_at, ends_at, finalized_at, result_post_id, participants_count, winners_count",
      )
      .order("starts_at", { ascending: false })
      .limit(15),
    getDisplaySession(db, now),
  ]);
  const board = displaySession ? await computeSessionRanking(db, displaySession.id, settings) : null;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            className="mb-3 inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md font-semibold text-on-surface-variant transition hover:border-[#173A67] hover:text-[#173A67]"
            href="/admin"
          >
            <MaterialIcon className="text-[18px] text-[#173A67]" name="dashboard" />
            <span>Tổng quan Admin</span>
          </Link>
          <h1 className="text-headline-md font-bold text-[#173A67]">Thi trắc nghiệm hàng tuần</h1>
          <p className="text-body-md text-[#27496D]">
            Quản lý ngân hàng câu hỏi, lịch mở thi, tổng kết cộng điểm và bài viết kết quả.
          </p>
        </div>
        <Link
          className="rounded-xl border-2 border-[#173A67] px-4 py-2 font-bold text-[#173A67] transition hover:bg-[#173A67] hover:text-white"
          href="/quiz"
        >
          Xem trang thi →
        </Link>
      </div>

      {sessionsError ? <p className="text-sm text-error">{sessionsError.message}</p> : null}

      <AdminQuizControl
        currentSession={currentSession}
        nextStartAt={currentSession ? null : (nextAutoStart(settings, now)?.toISOString() ?? null)}
        questionsCount={questions.length}
        serverNow={now.toISOString()}
        sessions={(sessions ?? []) as QuizSessionRow[]}
        settings={settings}
      />

      {displaySession && board ? (
        <QuizLeaderboard
          finalized={Boolean(displaySession.finalized_at)}
          isOpen={currentSession?.id === displaySession.id}
          participantsCount={board.participantsCount}
          ranking={board.ranking}
          resultPostId={displaySession.result_post_id}
          title={displaySession.title}
          totalQuestions={settings.questions_per_attempt}
        />
      ) : null}

      <AdminQuizQuestions questions={questions} />
    </div>
  );
}
