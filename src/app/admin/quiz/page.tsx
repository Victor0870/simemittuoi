import { HubTileGrid, type HubTile } from "@/components/admin/HubPage";
import { QuizTabs } from "./QuizTabs";
import { loadQuizData } from "./loadQuizData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuizPage() {
  const { currentSession, questions, sessionsError } = await loadQuizData("/admin/quiz");

  const tiles: HubTile[] = [
    {
      href: "/admin/quiz/settings",
      title: "Cài đặt",
      description: "Điều khiển sự kiện, lịch thi, điểm thưởng, kết quả.",
      icon: "tune",
      tint: "dusty",
      badge: currentSession ? "Đang mở" : null,
    },
    {
      href: "/admin/quiz/history",
      title: "Lịch sử thi",
      description: "Lịch sử đợt thi, bảng xếp hạng, lượt làm bài.",
      icon: "history",
      tint: "amber",
    },
    {
      href: "/admin/quiz/questions",
      title: "Ngân hàng câu hỏi",
      description: "Quản lý câu hỏi.",
      icon: "quiz",
      tint: "surface",
      badge: `${questions.length} câu hỏi`,
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <QuizTabs sessionsError={sessionsError?.message ?? null} />
      <HubTileGrid tiles={tiles} />
    </div>
  );
}
