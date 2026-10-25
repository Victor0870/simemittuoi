import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";
import { formatPollTime, getPollPhase } from "@/lib/polls/phase";
import { loadVoterBudget, resolvePointVoter, type PointVoter } from "@/lib/polls/points-server";
import { POINTS_PREDICTION_MAX, parsePointsPrediction, pointsReasonMessage } from "@/lib/polls/vote-mode";
import {
  deletePointsPrediction,
  loadPointsPrediction,
  savePointsPrediction,
} from "@/lib/polls/prediction-server";

async function loadPointsPoll(db: ReturnType<typeof createServiceClient>, pollId: string) {
  const { data, error } = await db.from(CDILV_TABLE.polls).select("*").eq("id", pollId).maybeSingle();
  if (error) throw error;
  return data;
}

async function voterPayload(db: ReturnType<typeof createServiceClient>, poll: Record<string, any>, voter: PointVoter) {
  const pollId = String(poll.id);
  const [budget, prediction] = await Promise.all([
    loadVoterBudget(db, pollId, voter),
    poll.has_prediction ? loadPointsPrediction(db, pollId, voter) : Promise.resolve(null),
  ]);
  return {
    prediction,
    isJudge: voter.isJudge,
    employeeCode: voter.employeeCode,
    isParticipant: budget.isParticipant,
    blockedOptionIds: budget.allowSelfVote ? [] : budget.memberOptionIds,
    base: budget.base,
    granted: budget.granted,
    budget: budget.budget,
    used: budget.used,
    remaining: Math.max(budget.budget - budget.used, 0),
    allocations: budget.allocations,
    grants: budget.grants,
  };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const pollId = params.get("pollId")?.trim();
    if (!pollId) {
      return NextResponse.json({ error: "Thiếu ID chương trình." }, { status: 400 });
    }

    const db = createServiceClient();
    const poll = await loadPointsPoll(db, pollId);
    if (!poll) {
      return NextResponse.json({ error: "Không tìm thấy chương trình bình chọn." }, { status: 404 });
    }
    if (poll.vote_mode !== "points") {
      return NextResponse.json({ error: pointsReasonMessage("not_points_mode") }, { status: 400 });
    }

    const resolved = await resolvePointVoter(db, poll, {
      employeeCode: params.get("employeeCode"),
      judgeToken: params.get("gk"),
    });
    if (!resolved.voter) {
      return NextResponse.json(
        { error: resolved.error, needsEmployeeCode: resolved.needsEmployeeCode ?? false },
        { status: resolved.status },
      );
    }

    return NextResponse.json(await voterPayload(db, poll, resolved.voter));
  } catch (err: any) {
    console.error("[api/polls/points] GET error:", err);
    return NextResponse.json({ error: err?.message || "Không tải được điểm bình chọn." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const pollId = String(body?.pollId ?? "").trim();
    const allocations = body?.allocations;
    if (!pollId || !Array.isArray(allocations)) {
      return NextResponse.json({ error: "Dữ liệu bình chọn không hợp lệ." }, { status: 400 });
    }
    if (allocations.length > 500) {
      return NextResponse.json({ error: "Quá nhiều bài thi trong một lần lưu." }, { status: 400 });
    }

    const db = createServiceClient();
    const poll = await loadPointsPoll(db, pollId);
    if (!poll) {
      return NextResponse.json({ error: "Không tìm thấy chương trình bình chọn." }, { status: 404 });
    }
    if (poll.vote_mode !== "points") {
      return NextResponse.json({ error: pointsReasonMessage("not_points_mode") }, { status: 400 });
    }

    const phase = getPollPhase({ status: poll.status, opensAt: poll.opens_at, votingEndsAt: poll.voting_ends_at });
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
      return NextResponse.json({ error: "Chương trình bình chọn đã hết thời gian nhận điểm." }, { status: 400 });
    }
    if (poll.is_active === false) {
      return NextResponse.json(
        { error: "Chương trình bình chọn đang ở trạng thái tạm ngưng (Inactive)." },
        { status: 400 },
      );
    }

    const resolved = await resolvePointVoter(db, poll, {
      employeeCode: body?.employeeCode,
      judgeToken: body?.judgeToken,
    });
    if (!resolved.voter) {
      return NextResponse.json(
        { error: resolved.error, needsEmployeeCode: resolved.needsEmployeeCode ?? false },
        { status: resolved.status },
      );
    }
    const voter = resolved.voter;

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const fingerprint = String(body?.deviceFingerprint || clientIp).slice(0, 200);

    const before = await loadVoterBudget(db, pollId, voter);
    const isNewGuest =
      voter.needsEmployeeCode && !voter.isPrivateJudgeVote && Object.keys(before.allocations).length === 0;
    const hasPoints = allocations.some((a: any) => Number(a?.points) > 0);

    let predictedTotal: number | null = null;
    if (poll.has_prediction && hasPoints) {
      const rawPrediction = body?.predictedTotal;
      const provided = rawPrediction !== undefined && rawPrediction !== null && rawPrediction !== "";
      predictedTotal = parsePointsPrediction(rawPrediction);
      if (provided && predictedTotal === null) {
        return NextResponse.json(
          { error: `Dự đoán phải là số nguyên từ 0 đến ${POINTS_PREDICTION_MAX.toLocaleString("vi-VN")}.` },
          { status: 400 },
        );
      }
      if (predictedTotal === null && !(await loadPointsPrediction(db, pollId, voter))) {
        return NextResponse.json(
          { error: "Vui lòng nhập dự đoán tổng điểm của bài thi đạt hạng Nhất." },
          { status: 400 },
        );
      }
    }

    if (isNewGuest && hasPoints) {
      const maxGuestVotes = poll.max_guest_votes ?? 250;
      if ((poll.guest_vote_count ?? 0) >= maxGuestVotes) {
        return NextResponse.json(
          {
            error:
              "Chương trình hiện chỉ mở bình chọn cho Đoàn viên Công đoàn đã đăng nhập. Quý đoàn viên vui lòng đăng nhập để bình chọn!",
            guestLimitReached: true,
          },
          { status: 403 },
        );
      }

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recent } = await db
        .from(CDILV_TABLE.pollPointAllocations)
        .select("id")
        .eq("poll_id", pollId)
        .neq("voter_key", before.voterKey)
        .or(`device_fingerprint.eq.${fingerprint},ip_address.eq.${clientIp}`)
        .gte("created_at", thirtyMinutesAgo)
        .limit(1);
      if (recent && recent.length > 0) {
        return NextResponse.json(
          {
            error:
              "Thiết bị này vừa bình chọn bằng mã nhân viên khác. Để chống spam, mỗi thiết bị chỉ bình chọn cho 1 mã mới trong 30 phút. Vui lòng thử lại sau!",
          },
          { status: 429 },
        );
      }
    }

    const { data: result, error: rpcError } = await db.rpc(CDILV_RPC.pollPointsAllocate, {
      p_poll_id: pollId,
      p_employee_code: voter.employeeCode,
      p_user_id: voter.userId,
      p_is_judge: voter.isJudge,
      p_ip_address: clientIp,
      p_device_fingerprint: fingerprint,
      p_allocations: allocations.map((a: any) => ({ optionId: a?.optionId, points: a?.points })),
    });
    if (rpcError) throw rpcError;

    const saved = (result ?? {}) as Record<string, any>;
    if (!saved.ok) {
      const message =
        saved.reason === "over_budget"
          ? `Tổng điểm (${saved.requested}) vượt quá số điểm được phân bổ (${saved.budget}).`
          : pointsReasonMessage(saved.reason);
      return NextResponse.json({ error: message, reason: saved.reason }, { status: 400 });
    }

    if (isNewGuest && Number(saved.used) > 0) {
      await db
        .from(CDILV_TABLE.polls)
        .update({ guest_vote_count: (poll.guest_vote_count ?? 0) + 1 })
        .eq("id", pollId);
    }

    if (poll.has_prediction) {
      if (Number(saved.used) > 0) {
        if (predictedTotal !== null) {
          await savePointsPrediction(db, {
            pollId,
            voter,
            value: predictedTotal,
            ipAddress: clientIp,
            fingerprint,
          });
        }
      } else {
        await deletePointsPrediction(db, pollId, voter);
      }
    }

    if (voter.userId && poll.voter_reward_points > 0 && Number(saved.used) > 0) {
      try {
        await db.rpc("cdilv_award_poll_vote_score", { p_poll_id: pollId, p_user_id: voter.userId });
      } catch (scoreErr) {
        console.error("[api/polls/points] score award RPC error:", scoreErr);
      }
    }

    return NextResponse.json({
      success: true,
      message:
        Number(saved.used) > 0
          ? `Đã lưu ${saved.used}/${saved.budget} điểm bình chọn.`
          : "Đã rút toàn bộ điểm bình chọn.",
      ...(await voterPayload(db, poll, voter)),
    });
  } catch (err: any) {
    console.error("[api/polls/points] POST error:", err);
    return NextResponse.json({ error: err?.message || "Đã xảy ra lỗi khi lưu điểm bình chọn." }, { status: 500 });
  }
}
