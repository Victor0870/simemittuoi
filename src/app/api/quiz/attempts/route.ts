import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { publishLeaderboardNow } from "@/lib/data/ranking-refresh";
import { requireQuizAdmin } from "@/lib/quiz-access";
import { computeSessionRanking, loadQuizSettings } from "@/lib/quiz";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

/**
 * GET: Lấy danh sách lượt thi của một đợt thi (cho Admin)
 */
export async function GET(request: NextRequest) {
  try {
    const { response } = await requireQuizAdmin();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    const db = createServiceClient();

    let query = db
      .from(CDILV_TABLE.quizAttempts)
      .select(`
        id,
        session_id,
        user_id,
        attempt_no,
        total_questions,
        correct_count,
        status,
        started_at,
        deadline_at,
        submitted_at,
        duration_ms
      `)
      .order("started_at", { ascending: false });

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    } else {
      query = query.limit(50);
    }

    const { data: attempts, error } = await query;
    if (error) throw error;

    const userIds = Array.from(new Set((attempts ?? []).map((a) => a.user_id)));
    const profilesMap = new Map<
      string,
      { full_name: string; department: string | null; avatar_url: string | null; employee_code?: string | null }
    >();

    if (userIds.length > 0) {
      const { data: profiles, error: pErr } = await db
        .from(CDILV_TABLE.profiles)
        .select("id, full_name, department, avatar_url, employee_code")
        .in("id", userIds);
      if (pErr) throw pErr;
      for (const p of profiles ?? []) {
        profilesMap.set(p.id, p);
      }
    }

    // Check award points if any
    const attemptIds = (attempts ?? []).map((a) => a.id);
    const attemptLabels = attemptIds.map((id) => `quiz_attempt_${id}`);
    const sessionIds = Array.from(new Set((attempts ?? []).map((a) => a.session_id)));
    const awardLabels = sessionIds.map((sid) => `quiz_${sid}`);
    const allLabels = [...attemptLabels, ...awardLabels];

    const attemptScoreMap = new Map<string, number>();
    const sessionScoreMap = new Map<string, number>();

    if (allLabels.length > 0) {
      const { data: scores } = await db
        .from(CDILV_TABLE.scoreEvents)
        .select("user_id, points, award_label")
        .in("award_label", allLabels);

      for (const s of scores ?? []) {
        if (s.award_label.startsWith("quiz_attempt_")) {
          const aid = s.award_label.replace("quiz_attempt_", "");
          attemptScoreMap.set(aid, s.points);
        } else if (s.award_label.startsWith("quiz_")) {
          const sid = s.award_label.replace("quiz_", "");
          sessionScoreMap.set(`${s.user_id}_${sid}`, s.points);
        }
      }
    }

    const enriched = (attempts ?? []).map((a) => {
      const profile = profilesMap.get(a.user_id);
      const attemptPoints = attemptScoreMap.get(a.id) ?? null;
      const rankBonus = sessionScoreMap.get(`${a.user_id}_${a.session_id}`) ?? null;
      return {
        ...a,
        profile: profile ?? { full_name: "Đoàn viên", department: null, avatar_url: null },
        awardedPoints: attemptPoints,
        rankingBonus: rankBonus,
      };
    });

    return NextResponse.json({ success: true, attempts: enriched });
  } catch (err: any) {
    console.error("[api/quiz/attempts] GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tải danh sách lượt thi." },
      { status: 500 },
    );
  }
}

/**
 * DELETE: Xóa lượt thi (và thu hồi điểm nếu đã tổng kết)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { response } = await requireQuizAdmin();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const attemptId = searchParams.get("attemptId");
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId");

    const db = createServiceClient();

    if (attemptId) {
      const { data: attempt, error: fetchErr } = await db
        .from(CDILV_TABLE.quizAttempts)
        .select("id, program_id, session_id, user_id, attempt_no")
        .eq("id", attemptId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!attempt) {
        return NextResponse.json({ error: "Không tìm thấy lượt thi." }, { status: 404 });
      }

      // Xóa lượt thi
      const { error: delErr } = await db
        .from(CDILV_TABLE.quizAttempts)
        .delete()
        .eq("id", attemptId);
      if (delErr) throw delErr;

      // Thu hồi điểm của riêng lượt thi này (nếu đã cộng)
      await db
        .from(CDILV_TABLE.scoreEvents)
        .delete()
        .eq("award_label", `quiz_attempt_${attemptId}`);

      // Kiểm tra xem người này còn lượt nào khác đúng 100% không
      const { data: otherAttempts } = await db
        .from(CDILV_TABLE.quizAttempts)
        .select("id, correct_count, total_questions")
        .eq("session_id", attempt.session_id)
        .eq("user_id", attempt.user_id)
        .eq("status", "submitted");

      const hasOtherPerfect = (otherAttempts ?? []).some(
        (o) => o.total_questions > 0 && o.correct_count === o.total_questions,
      );

      // Nếu không còn lượt nào đúng hết, thu hồi điểm thưởng xếp hạng đã cộng cho session này (nếu có)
      if (!hasOtherPerfect) {
        await db
          .from(CDILV_TABLE.scoreEvents)
          .delete()
          .eq("award_label", `quiz_${attempt.session_id}`)
          .eq("user_id", attempt.user_id);
      }

      // Cập nhật lại số người tham gia và đúng hết của session
      const settings = await loadQuizSettings(db, attempt.program_id);
      const { ranking, participantsCount } = await computeSessionRanking(db, attempt.session_id, settings);
      await db
        .from(CDILV_TABLE.quizSessions)
        .update({
          participants_count: participantsCount,
          winners_count: ranking.length,
        })
        .eq("id", attempt.session_id);

      revalidatePath("/admin/quiz");
      revalidatePath("/quiz");
      await publishLeaderboardNow();
      revalidatePath("/score-history");
      revalidatePath("/");

      return NextResponse.json({
        success: true,
        message: "Đã xóa lượt thi và thu hồi điểm liên quan.",
      });
    }

    if (sessionId && userId) {
      const { data: session, error: sErr } = await db
        .from(CDILV_TABLE.quizSessions)
        .select("program_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!session) {
        return NextResponse.json({ error: "Không tìm thấy đợt thi." }, { status: 404 });
      }

      // Tìm các lượt thi của user trong session này để thu hồi điểm
      const { data: userAttempts } = await db
        .from(CDILV_TABLE.quizAttempts)
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", userId);

      const attemptLabels = (userAttempts ?? []).map((u) => `quiz_attempt_${u.id}`);
      attemptLabels.push(`quiz_${sessionId}`);

      // Xóa tất cả các lượt của user trong session này
      await db
        .from(CDILV_TABLE.quizAttempts)
        .delete()
        .eq("session_id", sessionId)
        .eq("user_id", userId);

      // Thu hồi toàn bộ điểm (lượt thi + thưởng xếp hạng nếu có)
      await db
        .from(CDILV_TABLE.scoreEvents)
        .delete()
        .in("award_label", attemptLabels)
        .eq("user_id", userId);

      // Cập nhật session stats
      const settings = await loadQuizSettings(db, session.program_id);
      const { ranking, participantsCount } = await computeSessionRanking(db, sessionId, settings);
      await db
        .from(CDILV_TABLE.quizSessions)
        .update({
          participants_count: participantsCount,
          winners_count: ranking.length,
        })
        .eq("id", sessionId);

      revalidatePath("/admin/quiz");
      revalidatePath("/quiz");
      await publishLeaderboardNow();
      revalidatePath("/score-history");
      revalidatePath("/");

      return NextResponse.json({
        success: true,
        message: "Đã xóa toàn bộ kết quả thi của đoàn viên và thu hồi điểm.",
      });
    }

    return NextResponse.json({ error: "Thiếu thông tin để xóa lượt thi." }, { status: 400 });
  } catch (err: any) {
    console.error("[api/quiz/attempts] DELETE error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể xóa lượt thi." },
      { status: 500 },
    );
  }
}
