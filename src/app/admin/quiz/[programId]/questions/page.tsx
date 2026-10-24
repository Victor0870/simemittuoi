import { AdminQuizQuestions } from "@/components/admin/AdminQuizQuestions";
import { QUIZ_COMPACT_PAGE, QuizTabs } from "../../QuizTabs";
import { loadQuizData, requireQuizProgramPage } from "../../loadQuizData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuizQuestionsPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { db, program } = await requireQuizProgramPage(programId, "questions");
  const { questions, sessionsError } = await loadQuizData(db, program);

  return (
    <div className={QUIZ_COMPACT_PAGE}>
      <QuizTabs active="questions" program={program} sessionsError={sessionsError?.message ?? null} />
      <AdminQuizQuestions programId={program.id} questions={questions} />
    </div>
  );
}
