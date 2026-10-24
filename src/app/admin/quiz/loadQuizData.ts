import { redirect } from "next/navigation";
import {
  ensureCurrentSession,
  finalizeDueSessions,
  getDisplaySession,
  loadQuizSettings,
  selectAllRows,
} from "@/lib/quiz";
import type { QuizQuestionRow } from "@/lib/quiz-shared";
import { getSessionUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

/** Kiểm tra quyền admin và tải dữ liệu chung cho các trang Trắc nghiệm tuần; `nextPath` là trang quay lại sau đăng nhập. */
export async function loadQuizData(nextPath: string) {
  const [supabase, userId] = await Promise.all([createClient(), getSessionUserId()]);

  if (!userId) {
    redirect("/login?next=" + nextPath);
  }

  const db = createServiceClient();
  // Chỉ đọc cấu hình (không ghi) song song với kiểm tra quyền; lỗi (nếu có) được ném ra sau khi kiểm tra quyền như trước
  const settingsPromise = loadQuizSettings(db);
  settingsPromise.catch(() => {});

  const { data: me } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("role, approval_status")
    .eq("id", userId)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  const now = new Date();
  const settings = await settingsPromise;
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
