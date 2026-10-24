import { AdminQuizPrograms, type QuizProgramCard } from "@/components/admin/AdminQuizPrograms";
import { loadQuizPrograms } from "@/lib/quiz";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { requireQuizAdminPage } from "./loadQuizData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuizProgramsPage() {
  await requireQuizAdminPage("/admin/quiz");

  const db = createServiceClient();
  const nowIso = new Date().toISOString();
  const [programs, { data: openSessions, error: openErr }] = await Promise.all([
    loadQuizPrograms(db),
    db
      .from(CDILV_TABLE.quizSessions)
      .select("program_id")
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso),
  ]);
  if (openErr) throw openErr;
  const openProgramIds = new Set((openSessions ?? []).map((s) => s.program_id as string));

  const cards: QuizProgramCard[] = await Promise.all(
    programs.map(async (p) => {
      const [questions, sessions] = await Promise.all([
        db.from(CDILV_TABLE.quizQuestions).select("id", { count: "exact", head: true }).eq("program_id", p.id),
        db.from(CDILV_TABLE.quizSessions).select("id", { count: "exact", head: true }).eq("program_id", p.id),
      ]);
      if (questions.error) throw questions.error;
      if (sessions.error) throw sessions.error;
      return {
        ...p,
        questionsCount: questions.count ?? 0,
        sessionsCount: sessions.count ?? 0,
        isOpen: openProgramIds.has(p.id),
      };
    }),
  );

  return <AdminQuizPrograms programs={cards} />;
}
