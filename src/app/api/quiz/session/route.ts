import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { publishLeaderboardNow } from "@/lib/data/ranking-refresh";
import { ensureCurrentSession, loadQuizSettings, resolveQuizProgram } from "@/lib/quiz";
import { requireQuizAdmin } from "@/lib/quiz-access";
import { formatQuizDate, formatQuizTime, quizLabelPrefix } from "@/lib/quiz-shared";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

/** Admin bật / tắt đợt thi thủ công (dùng khi không chạy lịch tự động hoặc cần mở thêm). */
export async function POST(request: NextRequest) {
  try {
    const { userId, response } = await requireQuizAdmin();
    if (response) return response;

    const body = await request.json();
    const action = body.action;
    const writer = createServiceClient();
    const program = await resolveQuizProgram(writer, body.programId);
    if (!program) {
      return NextResponse.json({ error: "Không tìm thấy chương trình trắc nghiệm." }, { status: 404 });
    }
    const programId = program.id;
    const settings = await loadQuizSettings(writer, programId);
    const now = new Date();
    const current = await ensureCurrentSession(writer, program, settings, now);

    if (action === "open") {
      if (current) {
        return NextResponse.json({ error: "Đang có đợt thi mở." }, { status: 400 });
      }
      const minutes = Number(body.durationMinutes);
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 360) {
        return NextResponse.json(
          { error: "Thời lượng mở thi phải từ 5 đến 360 phút." },
          { status: 400 },
        );
      }
      const startsAt = now.toISOString();
      const endsAt = new Date(now.getTime() + minutes * 60_000).toISOString();
      const { error } = await writer.from(CDILV_TABLE.quizSessions).insert({
        program_id: programId,
        session_key: `manual-${now.getTime()}`,
        title: `${quizLabelPrefix(program)} ${formatQuizDate(startsAt)} (${formatQuizTime(startsAt)})`,
        mode: "manual",
        starts_at: startsAt,
        ends_at: endsAt,
        created_by: userId,
      });
      if (error) throw error;

      revalidatePath("/admin/quiz");
      revalidatePath("/quiz");
      return NextResponse.json({
        success: true,
        message: `Đã bật thi trắc nghiệm đến ${formatQuizTime(endsAt)}.`,
      });
    }

    if (action === "close") {
      if (!current) {
        return NextResponse.json({ error: "Hiện không có đợt thi nào đang mở." }, { status: 400 });
      }
      const { error } = await writer
        .from(CDILV_TABLE.quizSessions)
        .update({ ends_at: now.toISOString() })
        .eq("id", current.id);
      if (error) throw error;

      revalidatePath("/admin/quiz");
      revalidatePath("/quiz");
      return NextResponse.json({ success: true, message: "Đã tắt đợt thi trắc nghiệm." });
    }

    if (action === "delete") {
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
      if (!sessionId) {
        return NextResponse.json({ error: "Thiếu mã đợt thi cần xóa." }, { status: 400 });
      }

      const { data: session, error: sErr } = await writer
        .from(CDILV_TABLE.quizSessions)
        .select("id, result_post_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!session) {
        return NextResponse.json({ error: "Không tìm thấy đợt thi." }, { status: 404 });
      }

      // Tìm tất cả các lượt thi thuộc đợt này để thu hồi điểm từng lượt
      const { data: sessAttempts } = await writer
        .from(CDILV_TABLE.quizAttempts)
        .select("id")
        .eq("session_id", sessionId);

      const allLabels = (sessAttempts ?? []).map((a) => `quiz_attempt_${a.id}`);
      allLabels.push(`quiz_${sessionId}`);

      // Thu hồi điểm (điểm lượt thi + thưởng xếp hạng)
      await writer
        .from(CDILV_TABLE.scoreEvents)
        .delete()
        .in("award_label", allLabels);

      // Xóa bài viết kết quả (nếu có)
      if (session.result_post_id) {
        await writer
          .from(CDILV_TABLE.posts)
          .delete()
          .eq("id", session.result_post_id);
      }

      // Xóa tất cả các lượt thi thuộc đợt này
      await writer
        .from(CDILV_TABLE.quizAttempts)
        .delete()
        .eq("session_id", sessionId);

      // Xóa đợt thi
      const { error: delErr } = await writer
        .from(CDILV_TABLE.quizSessions)
        .delete()
        .eq("id", sessionId);
      if (delErr) throw delErr;

      revalidatePath("/admin/quiz");
      revalidatePath("/quiz");
      await publishLeaderboardNow();
      revalidatePath("/score-history");
      revalidatePath("/posts");
      revalidatePath("/");

      return NextResponse.json({
        success: true,
        message: "Đã xóa hoàn toàn đợt thi, các lượt thi và thu hồi điểm (nếu có).",
      });
    }

    if (action === "cancel_finalize") {
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
      if (!sessionId) {
        return NextResponse.json({ error: "Thiếu mã đợt thi." }, { status: 400 });
      }

      const { data: session, error: sErr } = await writer
        .from(CDILV_TABLE.quizSessions)
        .select("id, result_post_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!session) {
        return NextResponse.json({ error: "Không tìm thấy đợt thi." }, { status: 404 });
      }

      // Thu hồi điểm thưởng đã cộng cho session này
      await writer
        .from(CDILV_TABLE.scoreEvents)
        .delete()
        .eq("award_label", `quiz_${sessionId}`);

      // Xóa bài viết kết quả nếu có
      if (session.result_post_id) {
        await writer
          .from(CDILV_TABLE.posts)
          .delete()
          .eq("id", session.result_post_id);
      }

      // Reset trạng thái tổng kết về null
      const { error: updErr } = await writer
        .from(CDILV_TABLE.quizSessions)
        .update({
          finalized_at: null,
          result_post_id: null,
        })
        .eq("id", sessionId);
      if (updErr) throw updErr;

      revalidatePath("/admin/quiz");
      revalidatePath("/quiz");
      await publishLeaderboardNow();
      revalidatePath("/score-history");
      revalidatePath("/posts");
      revalidatePath("/");

      return NextResponse.json({
        success: true,
        message: "Đã hủy tổng kết, xóa bài viết và thu hồi toàn bộ điểm của đợt thi.",
      });
    }

    return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  } catch (err: any) {
    console.error("[api/quiz/session] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể cập nhật đợt thi." },
      { status: 500 },
    );
  }
}
