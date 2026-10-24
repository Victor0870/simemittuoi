import { redirect } from "next/navigation";
import { WEEKLY_QUIZ_PROGRAM_ID } from "@/lib/quiz-shared";
import { quizProgramHref } from "../QuizTabs";

export const dynamic = "force-dynamic";

/** Đường dẫn cũ: chuyển tới Ngân hàng câu hỏi của chương trình Trắc nghiệm tuần. */
export default function LegacyQuizQuestionsPage() {
  redirect(quizProgramHref(WEEKLY_QUIZ_PROGRAM_ID, "questions"));
}
