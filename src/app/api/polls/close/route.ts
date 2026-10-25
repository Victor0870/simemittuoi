import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { getPollPhase } from "@/lib/polls/phase";
import { invalidatePollResults, publishLeaderboardNow } from "@/lib/data/ranking-refresh";
import { loadPointTally } from "@/lib/polls/points-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const publicDb = createServiceClient();
    const access = await getCurrentAccess();
    if (!access || !hasPermission(access, PERMISSIONS.pollsManage)) {
      return NextResponse.json(
        { error: "Bạn chưa được phân quyền kết thúc chương trình bình chọn." },
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

    if (
      getPollPhase({ status: poll.status, opensAt: poll.opens_at, votingEndsAt: poll.voting_ends_at }) ===
      "upcoming"
    ) {
      return NextResponse.json(
        { error: "Chương trình đang ở trạng thái Sắp mở (chưa nhận phiếu thật), chưa thể đóng & trao giải." },
        { status: 400 },
      );
    }

    // 1. Fetch options
    const { data: optionsData } = await publicDb
      .from(CDILV_TABLE.pollOptions)
      .select("*")
      .eq("poll_id", pollId)
      .order("vote_count", { ascending: false })
      .order("order_num", { ascending: true });

    let options = optionsData ?? [];
    if (options.length === 0) {
      return NextResponse.json(
        { error: "Chương trình chưa có lựa chọn/tác phẩm nào." },
        { status: 400 },
      );
    }

    // Query votes to compute weighted scores & timestamps for tie-breaking
    const { data: votesData } = await publicDb
      .from(CDILV_TABLE.pollVotes)
      .select("option_id, is_judge, employee_code, user_id, submission_id, created_at")
      .eq("poll_id", pollId);

    const judgesVotedSet = new Set<string>();
    const othersVotedSet = new Set<string>();
    const judgeVotesByOpt = new Map<string, number>();
    const otherVotesByOpt = new Map<string, number>();
    const lastVoteAtByOpt = new Map<string, string>();

    for (const v of votesData ?? []) {
      const isJ = Boolean(v.is_judge);
      const voterKey = v.employee_code || v.user_id || v.submission_id;

      if (isJ) {
        if (voterKey) judgesVotedSet.add(voterKey);
        judgeVotesByOpt.set(
          v.option_id,
          (judgeVotesByOpt.get(v.option_id) || 0) + 1,
        );
      } else {
        if (voterKey) othersVotedSet.add(voterKey);
        otherVotesByOpt.set(
          v.option_id,
          (otherVotesByOpt.get(v.option_id) || 0) + 1,
        );
      }

      if (v.created_at) {
        const curLast = lastVoteAtByOpt.get(v.option_id);
        if (!curLast || new Date(v.created_at).getTime() > new Date(curLast).getTime()) {
          lastVoteAtByOpt.set(v.option_id, v.created_at);
        }
      }
    }

    const realVotesByOpt = new Map<string, number>();
    for (const v of votesData ?? []) {
      realVotesByOpt.set(v.option_id, (realVotesByOpt.get(v.option_id) || 0) + 1);
    }

    // Vote theo point: xếp hạng theo tổng điểm; tỉ lệ BGK/công khai tính trên tổng điểm của từng nhóm.
    let judgeDenominator: number | null = null;
    let otherDenominator: number | null = null;
    if (poll.vote_mode === "points") {
      const tally = await loadPointTally(publicDb, pollId);
      judgeVotesByOpt.clear();
      otherVotesByOpt.clear();
      lastVoteAtByOpt.clear();
      realVotesByOpt.clear();
      tally.judgeByOption.forEach((v, k) => judgeVotesByOpt.set(k, v));
      tally.publicByOption.forEach((v, k) => otherVotesByOpt.set(k, v));
      tally.lastAtByOption.forEach((v, k) => lastVoteAtByOpt.set(k, v));
      tally.totalByOption.forEach((v, k) => realVotesByOpt.set(k, v));
      judgeDenominator = tally.judgePointsTotal;
      otherDenominator = tally.publicPointsTotal;
    }
    for (const opt of options) {
      const real = realVotesByOpt.get(opt.id) || 0;
      if (opt.vote_count !== real) {
        opt.vote_count = real;
        await publicDb.from(CDILV_TABLE.pollOptions).update({ vote_count: real }).eq("id", opt.id);
      }
    }

    const totalJudgesVoted = judgesVotedSet.size;
    const totalOthersVoted = othersVotedSet.size;
    const judgeWeightPercent = poll.judge_weight_percent ?? 30;
    const judgeWeight = judgeWeightPercent / 10;
    const otherWeight = (100 - judgeWeightPercent) / 10;

    options = options
      .map((opt) => {
        let judgeVotes = 0;
        let otherVotes = 0;
        let judgeScore = 0;
        let otherScore = 0;
        let weightedScore = 0;

        if (poll.has_judges) {
          judgeVotes = judgeVotesByOpt.get(opt.id) || 0;
          otherVotes = otherVotesByOpt.get(opt.id) || 0;
          const judgeTotal = judgeDenominator ?? totalJudgesVoted;
          const otherTotal = otherDenominator ?? totalOthersVoted;
          const judgeRatio = judgeTotal > 0 ? judgeVotes / judgeTotal : 0;
          const otherRatio = otherTotal > 0 ? otherVotes / otherTotal : 0;
          judgeScore = Math.round(judgeRatio * judgeWeight * 100) / 100;
          otherScore = Math.round(otherRatio * otherWeight * 100) / 100;
          weightedScore = Math.round((judgeScore + otherScore) * 100) / 100;
        }

        return {
          ...opt,
          judge_votes: judgeVotes,
          other_votes: otherVotes,
          judge_score: judgeScore,
          other_score: otherScore,
          weighted_score: weightedScore,
          last_vote_at: lastVoteAtByOpt.get(opt.id) || null,
        };
      })
      .sort((a: any, b: any) => {
        if (poll.has_judges) {
          if (b.weighted_score !== a.weighted_score) {
            return b.weighted_score - a.weighted_score;
          }
        }
        if (b.vote_count !== a.vote_count) {
          return b.vote_count - a.vote_count;
        }
        // Khi bằng điểm/phiếu nhau: người nào nhận điểm trước sẽ ưu tiên vị trí cao hơn
        if (a.last_vote_at || b.last_vote_at) {
          if (!a.last_vote_at) return 1;
          if (!b.last_vote_at) return -1;
          const timeA = new Date(a.last_vote_at).getTime();
          const timeB = new Date(b.last_vote_at).getTime();
          if (timeA !== timeB) {
            return timeA - timeB;
          }
        }
        return a.order_num - b.order_num;
      });

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

    const winnerOpt = updatedOptions[0]; // Hạng 1 (cao điểm nhất)
    const actualWinningVotes = winnerOpt.vote_count;

    // 3. Find closest predictor
    let winningPredictorInfo = null;
    if (poll.has_prediction) {
      const { data: predictions } = await publicDb
        .from(CDILV_TABLE.pollPredictions)
        .select("*")
        .eq("poll_id", pollId)
        .order("created_at", { ascending: true });

      // Mỗi người (theo mã NV, hoặc tài khoản) chỉ tính dự đoán gửi sau cùng.
      const latestByPredictor = new Map<string, NonNullable<typeof predictions>[number]>();
      for (const p of predictions ?? []) {
        latestByPredictor.set(p.contact_info || (p.user_id ? `u:${p.user_id}` : `row:${p.id}`), p);
      }
      const finalPredictions = [...latestByPredictor.values()];

      if (finalPredictions.length > 0) {
        // Calculate difference and sort by diff asc, then earliest timestamp
        const sorted = finalPredictions
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

    // Thành viên tác phẩm chỉ lưu mã NV. Mã đã có tài khoản được duyệt thì phải cộng thẳng vào tài khoản:
    // điểm chờ theo mã chỉ được chuyển sang tài khoản lúc đăng ký, nên người đã có tài khoản sẽ không bao giờ thấy.
    const { data: allMembers } = await publicDb
      .from(CDILV_TABLE.pollOptionMembers)
      .select("employee_code")
      .in(
        "option_id",
        updatedOptions.map((opt) => opt.id),
      );
    const memberCodes = [
      ...new Set(
        (allMembers ?? [])
          .map((m) => String(m.employee_code || "").trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    const accountByCode = new Map<string, string>();
    if (memberCodes.length > 0) {
      const { data: profiles } = await publicDb
        .from(CDILV_TABLE.profiles)
        .select("id, employee_code, approval_status")
        .in("employee_code", memberCodes);
      for (const p of profiles ?? []) {
        const code = String(p.employee_code || "").trim().toUpperCase();
        if (code && p.approval_status === "approved") accountByCode.set(code, p.id);
      }
    }
    const resolveMemberUserId = (m: { user_id?: string | null; employee_code?: string | null }) =>
      m.user_id || accountByCode.get(String(m.employee_code || "").trim().toUpperCase()) || null;

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
            const memberUserId = resolveMemberUserId(m);

            if (memberUserId) {
              try {
                await publicDb.from(CDILV_TABLE.scoreEvents).insert({
                  user_id: memberUserId,
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

    // 4b. Điểm tham gia dự thi: mỗi mã nhân viên trên tác phẩm được cộng một lần.
    const entryPoints = parseInt(String(poll.entry_reward_points ?? 0), 10) || 0;
    if (entryPoints > 0) {
      const optionIds = updatedOptions.map((opt) => opt.id).filter(Boolean);
      const { data: entryMembers } = optionIds.length
        ? await publicDb
            .from(CDILV_TABLE.pollOptionMembers)
            .select("id, user_id, employee_code, full_name")
            .in("option_id", optionIds)
        : { data: [] };

      const byKey = new Map<
        string,
        { user_id: string | null; employee_code: string | null }
      >();
      for (const member of entryMembers || []) {
        const code = String(member.employee_code || "").trim().toUpperCase();
        const key = code || (member.user_id ? `user:${member.user_id}` : "");
        if (!key) continue;
        const previous = byKey.get(key);
        const userId = resolveMemberUserId(member);
        if (!previous || (!previous.user_id && userId)) {
          byKey.set(key, { ...member, user_id: userId, employee_code: code || member.employee_code });
        }
      }

      for (const [key, member] of byKey) {
        const code = String(member.employee_code || "").trim().toUpperCase();

        const awardLabel = `poll_entry_${pollId}_${key}`;
        const noteText = `Tham gia dự thi: ${poll.title} (+${entryPoints}đ)`;

        if (member.user_id) {
          const { error: scoreError } = await publicDb.from(CDILV_TABLE.scoreEvents).insert({
            user_id: member.user_id,
            employee_code: code || null,
            points: entryPoints,
            note: noteText,
            award_label: awardLabel,
            created_by: user.id,
          });
          if (scoreError && scoreError.code !== "23505") {
            console.error("[api/polls/close] entry score:", scoreError.message);
          }
        } else if (code) {
          const { data: existing } = await publicDb
            .from(CDILV_TABLE.employeeScoreEvents)
            .select("id")
            .eq("award_label", awardLabel)
            .limit(1);
          if (existing && existing.length > 0) continue;
          try {
            await publicDb.from(CDILV_TABLE.employeeScoreEvents).insert({
              employee_code: code,
              points: entryPoints,
              note: noteText,
              award_label: awardLabel,
              source: "poll_entry",
            });
          } catch {
            // ignore
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

    invalidatePollResults(pollId);
    await publishLeaderboardNow();
    try {
      revalidatePath("/polls");
      revalidatePath(`/polls/${pollId}`);
      revalidatePath("/admin/polls");
      revalidatePath("/");
    } catch {
      /* noop */
    }

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
