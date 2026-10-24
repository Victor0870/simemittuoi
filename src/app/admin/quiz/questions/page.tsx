import { AdminQuizQuestions } from "@/components/admin/AdminQuizQuestions";
import { QuizTabs } from "../QuizTabs";
import { loadQuizData } from "../loadQuizData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuizQuestionsPage() {
  const { questions, sessionsError } = await loadQuizData("/admin/quiz/questions");

  return (
    <div className="space-y-8 pb-10">
      <QuizTabs active="questions" sessionsError={sessionsError?.message ?? null} />
      <AdminQuizQuestions questions={questions} />
    </div>
  );
}
