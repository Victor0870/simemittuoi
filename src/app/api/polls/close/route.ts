import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const publicDb = createPublicClient();
    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (me?.role !== "admin" || me?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên mới có quyền thực hiện thao tác này." },
        { status: 403 },
      );
    }

    const { pollId } = await request.json();
    if (!pollId) {
      return NextResponse.json({ error: "Thiếu ID chương trình." }, { status: 400 });
    }

    const { data: poll, error: pollError } = await publicDb
      .from(CDILV_TABLE.polls)
      .select("*")
      .eq("id", pollId)
      .maybeSingle();

    if (pollError || !poll) {
      return NextResponse.json(
        { error: "Không tìm thấy chương trình." },
        { status: 404 },
      );
    }

    // 1. Fetch options sorted by vote_count desc, order_num asc (tie-break by original order)
    const { data: optionsData } = await publicDb
      .from(CDILV_TABLE.pollOptions)
      .select("*")
      .eq("poll_id", pollId)
      .order("vote_count", { ascending: false })
      .order("order_num", { ascending: true });

    const options = optionsData ?? [];
    if (options.length === 0) {
      return NextResponse.json(
        { error: "Chương trình chưa có lựa chọn/tác phẩm nào." },
        { status: 400 },
      );
    }

    // 2. Assign final ranks
    const updatedOptions = [];
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const rank = i + 1;
      await publicDb
        .from(CDILV_TABLE.pollOptions)
        .update({ final_rank: rank })
        .eq("id", opt.id);
      updatedOptions.push({ ...opt, final_rank: rank });
    }

    const winnerOpt = updatedOptions[0]; // Hạng 1
    const actualWinningVotes = winnerOpt.vote_count;

    // 3. Find closest predictor
    let winningPredictorInfo = null;
    if (poll.has_prediction) {
      const { data: predictions } = await publicDb
        .from(CDILV_TABLE.pollPredictions)
        .select("*")
        .eq("poll_id", pollId)
        .order("created_at", { ascending: true });

      if (predictions && predictions.length > 0) {
        // Calculate difference and sort by diff asc, then earliest timestamp
        const sorted = predictions
          .map((p) => ({
            ...p,
            diff: Math.abs(p.predicted_count - actualWinningVotes),
          }))
          .sort((a, b) => {
            if (a.diff !== b.diff) return a.diff - b.diff;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });

        const best = sorted[0];
        winningPredictorInfo = {
          id: best.id,
          fullName: best.full_name || "Đoàn viên dự đoán",
          contactInfo: best.contact_info || "",
          predictedCount: best.predicted_count,
          actualCount: actualWinningVotes,
          diff: best.diff,
          userId: best.user_id,
          createdAt: best.created_at,
        };

        // Award predictor points if member and reward > 0
        if (best.user_id && poll.predictor_reward_points > 0) {
          try {
            await publicDb.from(CDILV_TABLE.scoreEvents).insert({
              user_id: best.user_id,
              points: poll.predictor_reward_points,
              note: `Thưởng người dự đoán chính xác nhất: ${poll.title} (+${poll.predictor_reward_points}đ)`,
              award_label: `poll_predictor_${pollId}`,
              created_by: user.id,
            });
          } catch {
            // ignore unique violation
          }
        }
      }
    }

    // 4. If is_union_contest, award points to team members of winning options
    if (poll.is_union_contest) {
      for (const opt of updatedOptions) {
        let prizePoints = 0;
        let prizeName = "";

        if (opt.final_rank === 1) {
          prizePoints = poll.first_prize_points || 50;
          prizeName = "Giải Nhất";
        } else if (opt.final_rank === 2) {
          prizePoints = poll.second_prize_points || 40;
          prizeName = "Giải Nhì";
        } else if (opt.final_rank === 3) {
          prizePoints = poll.third_prize_points || 30;
          prizeName = "Giải Ba";
        } else if (
          opt.final_rank &&
          opt.final_rank <= 3 + (poll.consolation_prize_count || 2)
        ) {
          prizePoints = poll.consolation_prize_points || 20;
          prizeName = "Giải Khuyến khích";
        }

        if (prizePoints > 0) {
          // Get members of this option
          const { data: members } = await publicDb
            .from(CDILV_TABLE.pollOptionMembers)
            .select("*")
            .eq("option_id", opt.id);

          for (const m of members || []) {
            const noteText = `Đạt ${prizeName} - ${opt.title} (${poll.title}) (+${prizePoints}đ)`;
            const awardLabel = `poll_prize_${pollId}_opt_${opt.id}_m_${m.id}`;

            if (m.user_id) {
              try {
                await publicDb.from(CDILV_TABLE.scoreEvents).insert({
                  user_id: m.user_id,
                  employee_code: m.employee_code || null,
                  points: prizePoints,
                  note: noteText,
                  award_label: awardLabel,
                  created_by: user.id,
                });
              } catch {
                // ignore
              }
            } else if (m.employee_code) {
              try {
                await publicDb.from(CDILV_TABLE.employeeScoreEvents).insert({
                  employee_code: m.employee_code,
                  points: prizePoints,
                  note: noteText,
                  award_label: awardLabel,
                  source: "poll_award",
                });
              } catch {
                // ignore
              }
            }
          }
        }
      }
    }

    // 5. Update poll status to closed
    await publicDb
      .from(CDILV_TABLE.polls)
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        winning_option_id: winnerOpt.id,
        winning_predictor_info: winningPredictorInfo,
      })
      .eq("id", pollId);

    return NextResponse.json({
      success: true,
      message: "Đã kết thúc chương trình bình chọn và tự động cộng điểm thi đua!",
      winningOption: winnerOpt,
      winningPredictor: winningPredictorInfo,
    });
  } catch (err: any) {
    console.error("[api/polls/close] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi đóng chương trình." },
      { status: 500 },
    );
  }
}
