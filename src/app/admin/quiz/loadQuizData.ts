import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import {
  ensureCurrentSession,
  finalizeDueSessions,
  getDisplaySession,
  loadQuizProgram,
  loadQuizSettings,
  QUIZ_SESSION_COLUMNS,
  selectAllRows,
} from "@/lib/quiz";
import { WEEKLY_QUIZ_PROGRAM_ID, type QuizQuestionRow } from "@/lib/quiz-shared";
import { getSessionUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { quizProgramHref, type QuizTabKey } from "./QuizTabs";

/** Chỉ Admin vào trang quản trị Trắc nghiệm; `nextPath` là trang quay lại sau đăng nhập. */
export async function requireQuizAdminPage(nextPath: string) {
  const [supabase, userId] = await Promise.all([createClient(), getSessionUserId()]);

  if (!userId) {
    redirect("/login?next=" + nextPath);
  }

  const { data: me } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("role, approval_status")
    .eq("id", userId)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }
}

/**
 * Kiểm tra quyền admin và tìm chương trình trắc nghiệm theo `programId` (không có → 404).
 * Trang con (cài đặt / lịch sử / ngân hàng câu hỏi) hiện chỉ dành cho chương trình Trắc nghiệm tuần.
 */
export async function requireQuizProgramPage(programId: string, section?: QuizTabKey) {
  const db = createServiceClient();
  // Chỉ đọc (không ghi) song song với kiểm tra quyền; lỗi (nếu có) được ném ra sau khi kiểm tra quyền
  const programPromise = loadQuizProgram(db, programId);
  programPromise.catch(() => {});
  await requireQuizAdminPage(quizProgramHref(programId, section));
  const program = await programPromise;
  if (!program) notFound();
  if (section && program.id !== WEEKLY_QUIZ_PROGRAM_ID) {
    redirect(quizProgramHref(program.id));
  }
  return { db, program };
}

/** Tải dữ liệu chung cho các trang của một chương trình trắc nghiệm (cài đặt, đợt thi, câu hỏi). */
export async function loadQuizData(db: SupabaseClient, programId: string) {
  const now = new Date();
  const settings = await loadQuizSettings(db, programId);
  try {
    await finalizeDueSessions(db, programId, settings, now);
  } catch (err) {
    console.error("[admin/quiz] auto finalize error:", err);
  }
  const currentSession = await ensureCurrentSession(db, programId, settings, now);

  const [questions, { data: sessions, error: sessionsError }, displaySession] = await Promise.all([
    selectAllRows<QuizQuestionRow>((from, to) =>
      db
        .from(CDILV_TABLE.quizQuestions)
        .select("id, content, option_1, option_2, option_3, option_4, correct_option, created_at")
        .eq("program_id", programId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    db
      .from(CDILV_TABLE.quizSessions)
      .select(QUIZ_SESSION_COLUMNS)
      .eq("program_id", programId)
      .order("starts_at", { ascending: false })
      .limit(15),
    getDisplaySession(db, programId, now),
  ]);

  return { now, settings, currentSession, questions, sessions, sessionsError, displaySession };
}
