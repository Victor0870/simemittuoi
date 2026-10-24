import { AdminQuizControl } from "@/components/admin/AdminQuizControl";
import { nextAutoStart } from "@/lib/quiz";
import type { QuizSessionRow } from "@/lib/quiz-shared";
import { QuizTabs } from "../QuizTabs";
import { loadQuizData } from "../loadQuizData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuizSettingsPage() {
  const { now, settings, currentSession, questions, sessions, sessionsError } =
    await loadQuizData("/admin/quiz/settings");

  return (
    <div className="space-y-8 pb-10">
      <QuizTabs active="settings" sessionsError={sessionsError?.message ?? null} />

      <AdminQuizControl
        currentSession={currentSession}
        nextStartAt={currentSession ? null : (nextAutoStart(settings, now)?.toISOString() ?? null)}
        questionsCount={questions.length}
        serverNow={now.toISOString()}
        sessions={(sessions ?? []) as QuizSessionRow[]}
        settings={settings}
      />
    </div>
  );
}
