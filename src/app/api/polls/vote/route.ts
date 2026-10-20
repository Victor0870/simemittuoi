import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import {
  approvedAccountOwnsCode,
  isValidJudgeToken,
  judgeCodesFromPoll,
  normalizeEmployeeCode,
} from "@/lib/polls/judge-access";
import { formatPollTime, getPollPhase } from "@/lib/polls/phase";

const PUBLIC_JUDGE_BLOCKED =
  "Mã này thuộc Ban giám khảo chưa có tài khoản nên không bình chọn được qua link công khai. Vui lòng dùng link riêng do ban tổ chức gửi. Nếu bạn đã có tài khoản đoàn viên, hãy đăng nhập.";

const PRIVATE_JUDGE_ONLY =
  "Link này chỉ dành cho Ban giám khảo chưa có tài khoản. Mã nhân viên không có trong danh sách giám khảo.";

const PRIVATE_JUDGE_HAS_ACCOUNT =
  "Giám khảo đã có tài khoản đoàn viên. Vui lòng đăng nhập rồi bình chọn, không dùng link riêng này.";

async function shiftOptionVoteCount(
  publicDb: ReturnType<typeof createServiceClient>,
  optionId: string,
  delta: number,
) {
  if (!delta) return;
  const { data: opt, error } = await publicDb
    .from(CDILV_TABLE.pollOptions)
    .select("vote_count")
    .eq("id", optionId)
    .single();
  if (error) throw error;
  const next = Math.max(0, (opt?.vote_count || 0) + delta);
  const { error: updateError } = await publicDb
    .from(CDILV_TABLE.pollOptions)
    .update({ vote_count: next })
    .eq("id", optionId);
  if (updateError) throw updateError;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      pollId,
      optionIds,
      deviceFingerprint,
      predictedCount,
      employeeCode,
      judgeToken,
    } = body;

    if (!pollId || !Array.isArray(optionIds) || optionIds.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất 1 tác phẩm/lựa chọn để bình chọn." },
        { status: 400 },
      );
    }

    const publicDb = createServiceClient();
    const { data: poll, error: pollError } = await publicDb
      .from(CDILV_TABLE.polls)
      .select("*")
      .eq("id", pollId)
      .maybeSingle();

    if (pollError || !poll) {
      return NextResponse.json(
        { error: "Không tìm thấy chương trình bình chọn." },
        { status: 404 },
      );
    }

    const phase = getPollPhase({
      status: poll.status,
      opensAt: poll.opens_at,
      votingEndsAt: poll.voting_ends_at,
    });
    if (phase === "upcoming") {
      return NextResponse.json(
        {
          error: poll.opens_at
            ? `Chương trình chưa mở bình chọn. Thời gian mở: ${formatPollTime(poll.opens_at)}.`
            : "Chương trình chưa mở bình chọn. Vui lòng chờ ban tổ chức mở.",
        },
        { status: 400 },
      );
    }
    if (phase !== "open") {
      return NextResponse.json(
        { error: "Chương trình bình chọn đã hết thời gian nhận phiếu." },
        { status: 400 },
      );
    }

    if (poll.is_active === false) {
      return NextResponse.json(
        { error: "Chương trình bình chọn đang ở trạng thái tạm ngưng (Inactive)." },
        { status: 400 },
      );
    }

    if (optionIds.length > (poll.max_votes_per_user || 3)) {
      return NextResponse.json(
        {
          error: `Bạn chỉ được bình chọn tối đa ${poll.max_votes_per_user} tác phẩm.`,
        },
        { status: 400 },
      );
    }

    // Auth check — đoàn viên đã duyệt không cần nhập mã; người chưa là thành viên (free) thì bắt buộc.
    // Link riêng (?gk=) chỉ mở cho giám khảo chưa có tài khoản đoàn viên đã duyệt.
    const judgeCodes = judgeCodesFromPoll(poll);
    const judgeLinkOk =
      Boolean(poll.has_judges) && (await isValidJudgeToken(publicDb, pollId, judgeToken));

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let memberEmployeeCode: string | null = null;
    let memberFullName: string | null = null;
    let isApprovedMember = false;
    if (user) {
      const { data: profile } = await supabase
        .from(CDILV_TABLE.profiles)
        .select("approval_status, employee_code, full_name")
        .eq("id", user.id)
        .maybeSingle();
      isApprovedMember = profile?.approval_status === "approved";
      memberEmployeeCode = normalizeEmployeeCode(profile?.employee_code);
      if (isApprovedMember) memberFullName = profile?.full_name?.trim() || null;
    }

    if (poll.access_type === "members_only" && !isApprovedMember && !judgeLinkOk) {
      return NextResponse.json(
        {
          error: "Chương trình này chỉ dành riêng cho đoàn viên đã đăng nhập.",
        },
        { status: 401 },
      );
    }

    const needsEmployeeCode = !isApprovedMember && (poll.access_type === "free" || judgeLinkOk);
    const voterEmployeeCode = needsEmployeeCode
      ? normalizeEmployeeCode(employeeCode)
      : memberEmployeeCode;

    if (needsEmployeeCode && !voterEmployeeCode) {
      return NextResponse.json(
        {
          error:
            "Vui lòng nhập đầy đủ thông tin. Bạn cần nhập mã nhân viên trước khi bình chọn.",
        },
        { status: 400 },
      );
    }

    const codeIsJudge = Boolean(voterEmployeeCode && judgeCodes.has(voterEmployeeCode));
    const codeHasApprovedAccount =
      needsEmployeeCode && codeIsJudge && voterEmployeeCode
        ? await approvedAccountOwnsCode(publicDb, voterEmployeeCode)
        : false;

    if (needsEmployeeCode && codeIsJudge && !judgeLinkOk) {
      return NextResponse.json({ error: PUBLIC_JUDGE_BLOCKED }, { status: 403 });
    }

    if (judgeLinkOk && needsEmployeeCode) {
      if (!codeIsJudge) {
        return NextResponse.json({ error: PRIVATE_JUDGE_ONLY }, { status: 403 });
      }
      if (codeHasApprovedAccount) {
        return NextResponse.json({ error: PRIVATE_JUDGE_HAS_ACCOUNT }, { status: 403 });
      }
    }

    const isPrivateJudgeVote =
      judgeLinkOk && needsEmployeeCode && codeIsJudge && !codeHasApprovedAccount;

    // Safety limit check for free polls: max guest votes (default 250)
    const maxGuestVotes = poll.max_guest_votes ?? 250;
    const currentGuestVotes = poll.guest_vote_count ?? 0;

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const fingerprint = deviceFingerprint || clientIp;

    let priorVotes: { id: string; option_id: string }[] = [];
    if (voterEmployeeCode) {
      const { data: existingByCode, error: priorError } = await publicDb
        .from(CDILV_TABLE.pollVotes)
        .select("id, option_id")
        .eq("poll_id", pollId)
        .eq("employee_code", voterEmployeeCode);
      if (priorError) throw priorError;
      priorVotes = existingByCode ?? [];
    }
    const isReplacement = priorVotes.length > 0;

    if (needsEmployeeCode && !isReplacement && !isPrivateJudgeVote && currentGuestVotes >= maxGuestVotes) {
      return NextResponse.json(
        {
          error: "Chương trình hiện chỉ mở bình chọn cho Đoàn viên Công đoàn đã đăng nhập. Quý đoàn viên vui lòng đăng nhập để bình chọn!",
          guestLimitReached: true,
        },
        { status: 403 },
      );
    }

    if (needsEmployeeCode && !isReplacement && !isPrivateJudgeVote) {
      // IP & anti-spam check (1 phiếu mới / 30 phút). Phiếu trùng mã được ghi đè, không chặn. Phiếu link giám khảo không áp dụng.
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentVotes } = await publicDb
        .from(CDILV_TABLE.pollVotes)
        .select("id")
        .eq("poll_id", pollId)
        .or(`device_fingerprint.eq.${fingerprint},ip_address.eq.${clientIp}`)
        .gte("created_at", thirtyMinutesAgo)
        .limit(1);

      if (recentVotes && recentVotes.length > 0) {
        return NextResponse.json(
          {
            error:
              "Bạn đã bình chọn gần đây. Để đảm bảo công bằng và chống spam, mỗi thiết bị chỉ được bình chọn 1 lần trong 30 phút. Vui lòng thử lại sau!",
          },
          { status: 429 },
        );
      }
    } else if (isApprovedMember && user) {
      const { data: existingUserVotes } = await publicDb
        .from(CDILV_TABLE.pollVotes)
        .select("id")
        .eq("poll_id", pollId)
        .eq("user_id", user.id)
        .limit(1);

      if (existingUserVotes && existingUserVotes.length > 0) {
        return NextResponse.json(
          { error: "Bạn đã tham gia bình chọn cho chương trình này rồi." },
          { status: 400 },
        );
      }
    }

    if (isReplacement) {
      const removedByOption = new Map<string, number>();
      for (const row of priorVotes) {
        removedByOption.set(row.option_id, (removedByOption.get(row.option_id) ?? 0) + 1);
      }
      for (const [optId, count] of removedByOption) {
        await shiftOptionVoteCount(publicDb, optId, -count);
      }
      const { error: deleteError } = await publicDb
        .from(CDILV_TABLE.pollVotes)
        .delete()
        .in(
          "id",
          priorVotes.map((row) => row.id),
        );
      if (deleteError) throw deleteError;
    }

    // Phiếu giám khảo: đoàn viên đã duyệt có mã trong danh sách, hoặc khách vào bằng link riêng.
    const isJudge = codeIsJudge && (!needsEmployeeCode || isPrivateJudgeVote);

    // Insert votes
    const submissionId = crypto.randomUUID();
    const voteInserts = optionIds.map((optId: string) => ({
      poll_id: pollId,
      option_id: optId,
      user_id: user?.id || null,
      employee_code: voterEmployeeCode,
      ip_address: clientIp,
      device_fingerprint: fingerprint,
      submission_id: submissionId,
      is_judge: isJudge,
    }));

    const { error: insertVotesError } = await publicDb
      .from(CDILV_TABLE.pollVotes)
      .insert(voteInserts);

    if (insertVotesError) {
      throw insertVotesError;
    }

    // Phiếu khách mới thì tăng bộ đếm; phiếu ghi đè cùng mã nhân viên không tính thêm lượt.
    if (needsEmployeeCode && !isReplacement && !isPrivateJudgeVote) {
      await publicDb
        .from(CDILV_TABLE.polls)
        .update({ guest_vote_count: currentGuestVotes + 1 })
        .eq("id", pollId);
    }

    // Increment vote_count on options
    for (const optId of optionIds) {
      const { data: opt } = await publicDb
        .from(CDILV_TABLE.pollOptions)
        .select("vote_count")
        .eq("id", optId)
        .single();

      const newCount = (opt?.vote_count || 0) + 1;
      await publicDb
        .from(CDILV_TABLE.pollOptions)
        .update({ vote_count: newCount })
        .eq("id", optId);
    }

    // Save prediction if enabled and provided
    if (poll.has_prediction && predictedCount !== undefined && predictedCount !== null) {
      const predNum = parseInt(String(predictedCount), 10);
      if (!Number.isNaN(predNum)) {
        // Người dự đoán được nhận diện qua mã nhân viên, không cần tự nhập họ tên / liên hệ.
        const predictorCode = voterEmployeeCode || (isApprovedMember ? memberEmployeeCode : null);
        let predictorFullName = isApprovedMember ? memberFullName : null;
        if (!predictorFullName && predictorCode) {
          const { data: emp } = await publicDb
            .from(CDILV_TABLE.employeeWhitelist)
            .select("full_name")
            .ilike("employee_code", predictorCode)
            .limit(1)
            .maybeSingle();
          predictorFullName = emp?.full_name?.trim() || null;
        }
        await publicDb.from(CDILV_TABLE.pollPredictions).insert({
          poll_id: pollId,
          user_id: user?.id || null,
          predicted_count: predNum,
          full_name:
            predictorFullName && predictorCode
              ? `${predictorFullName} (${predictorCode})`
              : predictorFullName || (predictorCode ? `Mã NV ${predictorCode}` : null),
          contact_info: predictorCode ? `Mã NV: ${predictorCode}` : null,
          ip_address: clientIp,
          device_fingerprint: fingerprint,
        });
      }
    }

    // Award voter participation reward points if applicable via secure RPC
    if (user && poll.voter_reward_points > 0) {
      try {
        await publicDb.rpc("cdilv_award_poll_vote_score", {
          p_poll_id: pollId,
          p_user_id: user.id,
        });
      } catch (pollScoreErr) {
        console.error("[api/polls/vote] score award RPC error:", pollScoreErr);
      }
    }

    return NextResponse.json({
      success: true,
      replaced: isReplacement,
      message: isReplacement
        ? "Đã ghi nhận bình chọn mới. Mã nhân viên này đã có phiếu trước đó nên hệ thống lấy kết quả lần bình chọn sau."
        : "Bình chọn thành công! Cảm ơn bạn đã tham gia.",
    });
  } catch (err: any) {
    console.error("[api/polls/vote] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi gửi bình chọn." },
      { status: 500 },
    );
  }
}
