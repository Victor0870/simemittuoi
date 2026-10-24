import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { publishLeaderboardNow } from "@/lib/data/ranking-refresh";
import {
  finalizeQuizSession,
  loadQuizSettings,
  QUIZ_SESSION_COLUMNS,
  QUIZ_SUBMIT_GRACE_MS,
} from "@/lib/quiz";
import { requireQuizAdmin } from "@/lib/quiz-access";
import { QUIZ_TIMEZONE, type QuizSessionRow } from "@/lib/quiz-shared";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

/** Admin tổng kết đợt thi: cộng điểm sự kiện và đăng bài kết quả. */
export async function POST(request: NextRequest) {
  try {
    const { userId, response } = await requireQuizAdmin();
    if (response) return response;

    const body = await request.json();
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) return NextResponse.json({ error: "Thiếu mã đợt thi." }, { status: 400 });

    const writer = createServiceClient();
    const { data: session, error } = await writer
      .from(CDILV_TABLE.quizSessions)
      .select(QUIZ_SESSION_COLUMNS)
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!session) return NextResponse.json({ error: "Không tìm thấy đợt thi." }, { status: 404 });
    if (new Date(session.ends_at).getTime() > Date.now()) {
      return NextResponse.json(
        { error: "Đợt thi chưa kết thúc. Hãy tắt đợt thi trước khi tổng kết." },
        { status: 400 },
      );
    }

    const settings = await loadQuizSettings(writer, session.program_id);
    const lastSubmitAt =
      new Date(session.ends_at).getTime() + settings.time_limit_seconds * 1000 + QUIZ_SUBMIT_GRACE_MS;
    if (lastSubmitAt > Date.now()) {
      return NextResponse.json(
        {
          error: `Vui lòng chờ đến ${new Date(lastSubmitAt).toLocaleTimeString("vi-VN", { timeZone: QUIZ_TIMEZONE })} để các lượt đang làm dở nộp bài xong rồi tổng kết.`,
        },
        { status: 400 },
      );
    }
    const result = await finalizeQuizSession(writer, session as QuizSessionRow, settings, userId!);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    revalidatePath("/admin/quiz");
    revalidatePath("/quiz");
    revalidatePath("/");
    revalidatePath("/posts");
    await publishLeaderboardNow();
    return NextResponse.json({
      success: true,
      postId: result.postId,
      message: `Đã tổng kết: ${result.winnersCount} người đúng hết, cộng điểm cho ${result.awardedCount} người và đăng bài kết quả.`,
    });
  } catch (err: any) {
    console.error("[api/quiz/finalize] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tổng kết đợt thi." },
      { status: 500 },
    );
  }
}
