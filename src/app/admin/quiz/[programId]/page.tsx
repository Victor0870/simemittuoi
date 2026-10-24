import Link from "next/link";
import { HubTileGrid, type HubTile } from "@/components/admin/HubPage";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { WEEKLY_QUIZ_PROGRAM_ID } from "@/lib/quiz-shared";
import { QuizTabs, quizProgramHref } from "../QuizTabs";
import { loadQuizData, requireQuizProgramPage } from "../loadQuizData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuizProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { db, program } = await requireQuizProgramPage(programId);

  if (program.id !== WEEKLY_QUIZ_PROGRAM_ID) {
    return (
      <div className="space-y-6 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-headline-md font-bold text-[#173A67]">{program.name}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  program.is_active ? "bg-emerald-100 text-emerald-800" : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {program.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            {program.description ? (
              <p className="mt-1 whitespace-pre-line text-body-md text-[#27496D]">{program.description}</p>
            ) : null}
          </div>
          <Link
            className="rounded-xl border-2 border-[#173A67] px-4 py-2 font-bold text-[#173A67] transition hover:bg-[#173A67] hover:text-white"
            href="/admin/quiz"
          >
            ← Tất cả chương trình
          </Link>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-[#d2dfe9] bg-white p-5 text-sm text-[#27496D]">
          <MaterialIcon className="shrink-0 text-[22px] text-[#4a6b82]" name="construction" />
          <p>
            Chương trình đã được tạo. Cài đặt lịch thi, ngân hàng câu hỏi và lịch sử thi riêng cho chương trình này
            sẽ được bổ sung trong bản cập nhật tiếp theo.
          </p>
        </div>
      </div>
    );
  }

  const { currentSession, questions, sessionsError } = await loadQuizData(db, program.id);

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
      <QuizTabs programId={program.id} sessionsError={sessionsError?.message ?? null} />
      <HubTileGrid tiles={tiles} />
    </div>
  );
}
