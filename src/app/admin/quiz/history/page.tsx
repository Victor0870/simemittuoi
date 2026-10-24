import { redirect } from "next/navigation";
import { WEEKLY_QUIZ_PROGRAM_ID } from "@/lib/quiz-shared";
import { quizProgramHref } from "../QuizTabs";

/** Đường dẫn cũ: chuyển tới Lịch sử thi của chương trình Trắc nghiệm tuần (giữ ?round=). */
export default async function LegacyQuizHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const { round } = await searchParams;
  const query = typeof round === "string" && round ? `?round=${encodeURIComponent(round)}` : "";
  redirect(`${quizProgramHref(WEEKLY_QUIZ_PROGRAM_ID, "history")}${query}`);
}
