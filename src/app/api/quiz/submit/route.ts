import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { computeSessionRanking, loadQuizSettings, QUIZ_SUBMIT_GRACE_MS } from "@/lib/quiz";
import { requireQuizMember } from "@/lib/quiz-access";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function POST(request: NextRequest) {
  try {
    const { userId, response } = await requireQuizMember();
    if (response) return response;

    const body = await request.json();
    const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
    if (!attemptId) return NextResponse.json({ error: "Thiếu mã lượt thi." }, { status: 400 });

    const db = createServiceClient();
    const { data: attempt, error } = await db
      .from(CDILV_TABLE.quizAttempts)
      .select(
        "id, session_id, user_id, attempt_no, correct_options, total_questions, status, started_at, deadline_at",
      )
      .eq("id", attemptId)
      .maybeSingle();
    if (error) throw error;
    if (!attempt || attempt.user_id !== userId) {
      return NextResponse.json({ error: "Không tìm thấy lượt thi." }, { status: 404 });
    }
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "Lượt thi này đã được nộp." }, { status: 400 });
    }

    const total = attempt.total_questions as number;
    const rawAnswers: unknown[] = Array.isArray(body.answers) ? body.answers : [];
    const answers = Array.from({ length: total }, (_, i) => {
      const n = Number(rawAnswers[i]);
      return Number.isInteger(n) && n >= 1 && n <= 4 ? n : null;
    });

    const now = Date.now();
    const startedMs = new Date(attempt.started_at).getTime();
    const deadlineMs = new Date(attempt.deadline_at).getTime();
    const late = now > deadlineMs + QUIZ_SUBMIT_GRACE_MS;
    const correctOptions = attempt.correct_options as number[];
    const correctCount = late
      ? 0
      : answers.reduce<number>((sum, a, i) => (a !== null && a === correctOptions[i] ? sum + 1 : sum), 0);

    const clientSubmittedMs = typeof body.clientSubmittedAt === "number" ? body.clientSubmittedAt : null;
    const effectiveSubmitTime =
      clientSubmittedMs && clientSubmittedMs >= startedMs && clientSubmittedMs <= now + 2000
        ? Math.min(clientSubmittedMs, now)
        : now;
    const durationMs = Math.max(0, Math.min(effectiveSubmitTime, deadlineMs) - startedMs);

    const { data: updated, error: updErr } = await db
      .from(CDILV_TABLE.quizAttempts)
      .update({
        answers,
        correct_count: correctCount,
        status: late ? "expired" : "submitted",
        submitted_at: new Date(effectiveSubmitTime).toISOString(),
        duration_ms: durationMs,
      })
      .eq("id", attempt.id)
      .eq("status", "in_progress")
      .select("id")
      .maybeSingle();
    if (updErr) throw updErr;
    if (!updated) return NextResponse.json({ error: "Lượt thi này đã được nộp." }, { status: 400 });

    const settings = await loadQuizSettings(db);
    const attemptPoints = !late ? Number(settings.points_per_attempt ?? 2) : 0;

    if (attemptPoints > 0) {
      const awardLabel = `quiz_attempt_${attempt.id}`;
      const { data: existingEvent } = await db
        .from(CDILV_TABLE.scoreEvents)
        .select("id")
        .eq("award_label", awardLabel)
        .maybeSingle();

      if (!existingEvent) {
        const { error: scoreErr } = await db.from(CDILV_TABLE.scoreEvents).insert({
          user_id: userId,
          points: attemptPoints,
          note: `Thi trắc nghiệm – Lượt ${attempt.attempt_no} (+${attemptPoints}đ)`,
          award_label: awardLabel,
          created_by: userId,
        });
        if (scoreErr) {
          console.error("[api/quiz/submit] Lỗi khi cộng điểm lượt thi:", scoreErr);
        }
      }
    }

    const [{ count: attemptsUsed }, { ranking }] = await Promise.all([
      db
        .from(CDILV_TABLE.quizAttempts)
        .select("id", { count: "exact", head: true })
        .eq("session_id", attempt.session_id)
        .eq("user_id", userId!),
      computeSessionRanking(db, attempt.session_id, settings),
    ]);
    const mine = ranking.find((r) => r.user_id === userId);

    revalidatePath("/quiz");
    revalidatePath("/score-history");
    revalidatePath("/leaderboard");
    revalidatePath("/");

    return NextResponse.json({
      success: true,
      late,
      correctCount,
      total,
      durationMs,
      perfect: !late && correctCount === total,
      earnedPoints: attemptPoints,
      attemptsUsed: attemptsUsed ?? attempt.attempt_no,
      maxAttempts: settings.max_attempts,
      currentRank: mine?.rank ?? null,
      bestDurationMs: mine?.duration_ms ?? null,
    });
  } catch (err: any) {
    console.error("[api/quiz/submit] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể nộp bài." },
      { status: 500 },
    );
  }
}
