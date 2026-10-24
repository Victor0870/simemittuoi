import { AdminQuizControl } from "@/components/admin/AdminQuizControl";
import { nextAutoStart } from "@/lib/quiz";
import type { QuizSessionRow } from "@/lib/quiz-shared";
import { QUIZ_COMPACT_PAGE, QuizTabs } from "../../QuizTabs";
import { loadQuizData, requireQuizProgramPage } from "../../loadQuizData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuizSettingsPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { db, program } = await requireQuizProgramPage(programId, "settings");
  const { now, settings, currentSession, questions, sessions, sessionsError } = await loadQuizData(db, program);

  return (
    // Mở form cài đặt (details) thì bỏ khóa chiều cao để trang cuộn bình thường
    <div className={`${QUIZ_COMPACT_PAGE} lg:has-[details[open]]:h-auto lg:has-[details[open]]:overflow-visible`}>
      <QuizTabs active="settings" program={program} sessionsError={sessionsError?.message ?? null} />

      <AdminQuizControl
        currentSession={currentSession}
        nextStartAt={currentSession ? null : (nextAutoStart(settings, now)?.toISOString() ?? null)}
        programId={program.id}
        questionsCount={questions.length}
        serverNow={now.toISOString()}
        sessions={(sessions ?? []) as QuizSessionRow[]}
        settings={settings}
      />
    </div>
  );
}
