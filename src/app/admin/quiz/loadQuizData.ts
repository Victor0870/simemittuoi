import { redirect } from "next/navigation";
import {
  ensureCurrentSession,
  finalizeDueSessions,
  getDisplaySession,
  loadQuizSettings,
  selectAllRows,
} from "@/lib/quiz";
import type { QuizQuestionRow } from "@/lib/quiz-shared";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

/** Kiểm tra quyền admin và tải dữ liệu chung cho các trang Trắc nghiệm tuần; `nextPath` là trang quay lại sau đăng nhập. */
export async function loadQuizData(nextPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=" + nextPath);
  }

  const { data: me } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  const db = createServiceClient();
  const now = new Date();
  const settings = await loadQuizSettings(db);
  try {
    await finalizeDueSessions(db, settings, now);
  } catch (err) {
    console.error("[admin/quiz] auto finalize error:", err);
  }
  const currentSession = await ensureCurrentSession(db, settings, now);

  const [questions, { data: sessions, error: sessionsError }, displaySession] = await Promise.all([
    selectAllRows<QuizQuestionRow>((from, to) =>
      db
        .from(CDILV_TABLE.quizQuestions)
        .select("id, content, option_1, option_2, option_3, option_4, correct_option, created_at")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    db
      .from(CDILV_TABLE.quizSessions)
      .select(
        "id, session_key, title, mode, starts_at, ends_at, finalized_at, result_post_id, participants_count, winners_count",
      )
      .order("starts_at", { ascending: false })
      .limit(15),
    getDisplaySession(db, now),
  ]);

  return { db, now, settings, currentSession, questions, sessions, sessionsError, displaySession };
}
