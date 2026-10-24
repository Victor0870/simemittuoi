import { NextResponse } from "next/server";
import {
  ensureCurrentSession,
  loadQuizSettings,
  QUIZ_SUBMIT_GRACE_MS,
  selectAllRows,
} from "@/lib/quiz";
import { requireQuizMember } from "@/lib/quiz-access";
import { WEEKLY_QUIZ_PROGRAM_ID } from "@/lib/quiz-shared";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

type AttemptRow = {
  id: string;
  attempt_no: number;
  question_ids: string[];
  status: string;
  started_at: string;
  deadline_at: string;
};

function shuffle<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Bắt đầu lượt mới (hoặc tiếp tục lượt đang làm dở). Không bao giờ trả đáp án đúng về client. */
export async function POST() {
  try {
    const { userId, response } = await requireQuizMember();
    if (response) return response;

    const db = createServiceClient();
    const programId = WEEKLY_QUIZ_PROGRAM_ID;
    const settings = await loadQuizSettings(db, programId);
    const now = new Date();
    const session = await ensureCurrentSession(db, programId, settings, now);
    if (!session) {
      return NextResponse.json(
        { error: "Sự kiện thi trắc nghiệm hiện chưa mở." },
        { status: 400 },
      );
    }

    const { data: attemptData, error: attErr } = await db
      .from(CDILV_TABLE.quizAttempts)
      .select("id, attempt_no, question_ids, status, started_at, deadline_at")
      .eq("session_id", session.id)
      .eq("user_id", userId!)
      .order("attempt_no", { ascending: true });
    if (attErr) throw attErr;
    const attempts = (attemptData ?? []) as AttemptRow[];

    let attempt = attempts.find((a) => a.status === "in_progress") ?? null;
    if (attempt && new Date(attempt.deadline_at).getTime() + QUIZ_SUBMIT_GRACE_MS <= now.getTime()) {
      await db
        .from(CDILV_TABLE.quizAttempts)
        .update({ status: "expired", correct_count: 0 })
        .eq("id", attempt.id)
        .eq("status", "in_progress");
      attempt = null;
    }

    if (!attempt) {
      if (attempts.length >= settings.max_attempts) {
        return NextResponse.json(
          { error: `Bạn đã dùng hết ${settings.max_attempts} lượt chơi của đợt thi này.` },
          { status: 400 },
        );
      }

      const allIds = (
        await selectAllRows<{ id: string }>((from, to) =>
          db
            .from(CDILV_TABLE.quizQuestions)
            .select("id")
            .eq("program_id", programId)
            .order("id")
            .range(from, to),
        )
      ).map((q) => q.id);
      const n = settings.questions_per_attempt;
      if (allIds.length < n) {
        return NextResponse.json(
          { error: "Ngân hàng câu hỏi chưa đủ câu. Vui lòng liên hệ Ban tổ chức." },
          { status: 400 },
        );
      }

      const seen = new Set(attempts.flatMap((a) => a.question_ids));
      const unseen = shuffle(allIds.filter((id) => !seen.has(id)));
      const picked =
        unseen.length >= n
          ? unseen.slice(0, n)
          : [...unseen, ...shuffle(allIds.filter((id) => seen.has(id)))].slice(0, n);

      const { data: qs, error: qErr } = await db
        .from(CDILV_TABLE.quizQuestions)
        .select("id, correct_option")
        .eq("program_id", programId)
        .in("id", picked);
      if (qErr) throw qErr;
      const correctById = new Map((qs ?? []).map((q) => [q.id, q.correct_option as number]));
      const questionIds = picked.filter((id) => correctById.has(id));
      if (questionIds.length < n) {
        return NextResponse.json({ error: "Câu hỏi vừa thay đổi, vui lòng thử lại." }, { status: 409 });
      }

      const startedAt = now.toISOString();
      const deadlineAt = new Date(now.getTime() + settings.time_limit_seconds * 1000).toISOString();
      const { data: inserted, error: insErr } = await db
        .from(CDILV_TABLE.quizAttempts)
        .insert({
          program_id: programId,
          session_id: session.id,
          user_id: userId,
          attempt_no: attempts.length + 1,
          question_ids: questionIds,
          correct_options: questionIds.map((id) => correctById.get(id)),
          total_questions: questionIds.length,
          started_at: startedAt,
          deadline_at: deadlineAt,
        })
        .select("id, attempt_no, question_ids, status, started_at, deadline_at")
        .single();
      if (insErr) {
        if (insErr.code === "23505") {
          return NextResponse.json({ error: "Lượt chơi đang được tạo, vui lòng thử lại." }, { status: 409 });
        }
        throw insErr;
      }
      attempt = inserted as AttemptRow;
    }

    const { data: questionRows, error: qrErr } = await db
      .from(CDILV_TABLE.quizQuestions)
      .select("id, content, option_1, option_2, option_3, option_4")
      .in("id", attempt.question_ids);
    if (qrErr) throw qrErr;
    const byId = new Map((questionRows ?? []).map((q) => [q.id, q]));

    return NextResponse.json({
      attemptId: attempt.id,
      attemptNo: attempt.attempt_no,
      maxAttempts: settings.max_attempts,
      startedAt: attempt.started_at,
      deadlineAt: attempt.deadline_at,
      serverNow: new Date().toISOString(),
      sessionEndsAt: session.ends_at,
      questions: attempt.question_ids.map((id) => {
        const q = byId.get(id);
        return {
          id,
          content: q?.content ?? "(Câu hỏi đã bị xóa)",
          options: q ? [q.option_1, q.option_2, q.option_3, q.option_4] : ["—", "—", "—", "—"],
        };
      }),
    });
  } catch (err: any) {
    console.error("[api/quiz/start] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể bắt đầu lượt thi." },
      { status: 500 },
    );
  }
}
