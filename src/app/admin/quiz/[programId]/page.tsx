import { AdminQuizProgramEditor } from "@/components/admin/AdminQuizProgramEditor";
import { HubTileGrid, type HubTile } from "@/components/admin/HubPage";
import { WEEKLY_QUIZ_PROGRAM_ID } from "@/lib/quiz-shared";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { QuizTabs, quizProgramHref } from "../QuizTabs";
import { loadQuizData, requireQuizProgramPage } from "../loadQuizData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuizProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { db, program } = await requireQuizProgramPage(programId);

  const [{ currentSession, questions, sessionsError }, { count: attemptsCount, error: attemptsError }] =
    await Promise.all([
      loadQuizData(db, program),
      db
        .from(CDILV_TABLE.quizAttempts)
        .select("id", { count: "exact", head: true })
        .eq("program_id", program.id),
    ]);
  if (attemptsError) throw attemptsError;

  const tiles: HubTile[] = [
    {
      href: quizProgramHref(program.id, "settings"),
      title: "Cài đặt",
      description: "Điều khiển sự kiện, lịch thi, điểm thưởng, kết quả.",
      icon: "tune",
      tint: "dusty",
      badge: currentSession ? "Đang mở" : null,
    },
    {
      href: quizProgramHref(program.id, "history"),
      title: "Lịch sử thi",
      description: "Lịch sử đợt thi, bảng xếp hạng, lượt làm bài.",
      icon: "history",
      tint: "amber",
    },
    {
      href: quizProgramHref(program.id, "questions"),
      title: "Ngân hàng câu hỏi",
      description: "Quản lý câu hỏi.",
      icon: "quiz",
      tint: "surface",
      badge: `${questions.length} câu hỏi`,
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <QuizTabs program={program} sessionsError={sessionsError?.message ?? null} />
      <AdminQuizProgramEditor
        canDelete={program.id !== WEEKLY_QUIZ_PROGRAM_ID && (attemptsCount ?? 0) === 0}
        program={program}
      />
      <HubTileGrid tiles={tiles} />
    </div>
  );
}
