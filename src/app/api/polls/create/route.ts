import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureJudgeToken } from "@/lib/polls/judge-access";
import { parsePollSchedule } from "@/lib/polls/phase";
import { normalizeRewardMoney } from "@/lib/polls/reward-money";
import { parseSubmissionDeadline } from "@/lib/polls/entries-server";
import { normalizePointsBudget, normalizeSubmissionMode, normalizeVoteMode } from "@/lib/polls/vote-mode";
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

    const publicDb = createServiceClient();
    const access = await getCurrentAccess();
    if (!access || !hasPermission(access, PERMISSIONS.pollsManage)) {
      return NextResponse.json(
        { error: "Bạn chưa được phân quyền tạo chương trình bình chọn." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      pollType = "vote",
      accessType = "free",
      contentType = "image",
      maxVotesPerUser = 3,
      hasPrediction = true,
      predictionQuestion,
      voterRewardPoints = 10,
      entryRewardPoints = 0,
      predictorRewardPoints = 50,
      isUnionContest = true,
      firstPrizePoints = 50,
      secondPrizePoints = 40,
      thirdPrizePoints = 30,
      consolationPrizePoints = 20,
      consolationPrizeCount = 2,
      maxGuestVotes = 250,
      isActive = true,
      hasJudges = false,
      judgeWeightPercent = 30,
      judgeList = [],
      options = [],
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên chương trình bình chọn." },
        { status: 400 },
      );
    }

    const submissionMode = normalizeSubmissionMode(body.submissionMode);
    if (!Array.isArray(options) || (submissionMode !== "player" && options.length < 2)) {
      return NextResponse.json(
        { error: "Chương trình bình chọn cần có ít nhất 2 lựa chọn/bài thi." },
        { status: 400 },
      );
    }

    const schedule = parsePollSchedule(body);
    if (!schedule.ok) {
      return NextResponse.json({ error: schedule.error }, { status: 400 });
    }

    const voteMode = normalizeVoteMode(body.voteMode);
    const submissionDeadline = parseSubmissionDeadline(body.submissionDeadline);
    if (!submissionDeadline.ok) {
      return NextResponse.json({ error: submissionDeadline.error }, { status: 400 });
    }

    // 1. Insert poll
    const { data: poll, error: pollError } = await publicDb
      .from(CDILV_TABLE.polls)
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        poll_type: pollType,
        access_type: accessType,
        content_type: contentType,
        status: schedule.value?.mode ?? "open",
        opens_at: schedule.value?.opensAt ?? null,
        voting_ends_at: schedule.value?.votingEndsAt ?? null,
        is_active: isActive !== false,
        max_votes_per_user: parseInt(String(maxVotesPerUser), 10) || 3,
        max_guest_votes: parseInt(String(maxGuestVotes), 10) || 250,
        has_prediction: Boolean(hasPrediction),
        vote_mode: voteMode,
        points_per_participant: normalizePointsBudget(body.pointsPerParticipant),
        points_per_non_participant: normalizePointsBudget(body.pointsPerNonParticipant),
        allow_self_vote: Boolean(body.allowSelfVote),
        submission_mode: submissionMode,
        submission_deadline: submissionDeadline.value,
        prediction_question:
          predictionQuestion?.trim() ||
          "Theo bạn có bao nhiêu người bình chọn cho bài thi đạt giải nhất?",
        voter_reward_points: parseInt(String(voterRewardPoints), 10) || 0,
        entry_reward_points: parseInt(String(entryRewardPoints), 10) || 0,
        predictor_reward_points: parseInt(String(predictorRewardPoints), 10) || 0,
        is_union_contest: Boolean(isUnionContest),
        first_prize_points: parseInt(String(firstPrizePoints), 10) || 0,
        second_prize_points: parseInt(String(secondPrizePoints), 10) || 0,
        third_prize_points: parseInt(String(thirdPrizePoints), 10) || 0,
        consolation_prize_points: parseInt(String(consolationPrizePoints), 10) || 0,
        consolation_prize_count: parseInt(String(consolationPrizeCount), 10) || 2,
        reward_money: normalizeRewardMoney(body.rewardMoney),
        has_judges: Boolean(hasJudges),
        judge_weight_percent: Math.min(
          95,
          Math.max(5, parseInt(String(judgeWeightPercent), 10) || 30),
        ),
        judge_list: Array.isArray(judgeList) ? judgeList : [],
        created_by: user.id,
      })
      .select("id")
      .single();

    if (pollError || !poll) {
      throw pollError || new Error("Không thể tạo poll");
    }

    await ensureJudgeToken(publicDb, poll.id);

    // 2. Insert options & members
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const { data: optRow, error: optError } = await publicDb
        .from(CDILV_TABLE.pollOptions)
        .insert({
          poll_id: poll.id,
          order_num: i + 1,
          title: opt.title?.trim() || `Lựa chọn ${i + 1}`,
          description: opt.description?.trim() || null,
          image_urls: opt.imageUrls || [],
          is_active: opt.isActive !== false,
        })
        .select("id")
        .single();

      if (optError || !optRow) continue;

      if (Array.isArray(opt.members) && opt.members.length > 0) {
        for (const m of opt.members) {
          if (!m.fullName || !m.fullName.trim()) continue;
          await publicDb.from(CDILV_TABLE.pollOptionMembers).insert({
            option_id: optRow.id,
            full_name: m.fullName.trim(),
            employee_code: m.employeeCode?.trim() || null,
          });
        }
      }
    }

    try {
      revalidatePath("/polls");
      revalidatePath("/admin/polls");
      revalidatePath("/");
    } catch {
      /* noop */
    }

    return NextResponse.json({
      success: true,
      pollId: poll.id,
      message: "Tạo chương trình bình chọn thành công!",
    });
  } catch (err: any) {
    console.error("[api/polls/create] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi tạo chương trình." },
      { status: 500 },
    );
  }
}
