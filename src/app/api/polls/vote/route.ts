import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      pollId,
      optionIds,
      deviceFingerprint,
      predictedCount,
      predictorName,
      predictorContact,
    } = body;

    if (!pollId || !Array.isArray(optionIds) || optionIds.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất 1 tác phẩm/lựa chọn để bình chọn." },
        { status: 400 },
      );
    }

    const publicDb = createPublicClient();
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

    if (poll.status !== "open") {
      return NextResponse.json(
        { error: "Chương trình bình chọn đã kết thúc hoặc chưa mở." },
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

    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (poll.access_type === "members_only" && !user) {
      return NextResponse.json(
        {
          error: "Chương trình này chỉ dành riêng cho đoàn viên đã đăng nhập.",
        },
        { status: 401 },
      );
    }

    // Safety limit check for free polls: max guest votes (default 250)
    const maxGuestVotes = poll.max_guest_votes ?? 250;
    const currentGuestVotes = poll.guest_vote_count ?? 0;

    if (!user) {
      if (poll.access_type === "free" && currentGuestVotes >= maxGuestVotes) {
        return NextResponse.json(
          {
            error: "Chương trình hiện chỉ mở bình chọn cho Đoàn viên Công đoàn đã đăng nhập. Quý đoàn viên vui lòng đăng nhập để bình chọn!",
            guestLimitReached: true,
          },
          { status: 403 },
        );
      }
    }

    // IP & anti-spam check (1 vote / 30 minutes in free mode)
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const fingerprint = deviceFingerprint || clientIp;

    if (!user) {
      // Check last 30 minutes
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
    } else {
      // Check if user already voted in this poll
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

    // Insert votes
    const submissionId = crypto.randomUUID();
    const voteInserts = optionIds.map((optId: string) => ({
      poll_id: pollId,
      option_id: optId,
      user_id: user?.id || null,
      ip_address: clientIp,
      device_fingerprint: fingerprint,
      submission_id: submissionId,
    }));

    const { error: insertVotesError } = await publicDb
      .from(CDILV_TABLE.pollVotes)
      .insert(voteInserts);

    if (insertVotesError) {
      throw insertVotesError;
    }

    // If guest vote, increment guest_vote_count on poll
    if (!user) {
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
        await publicDb.from(CDILV_TABLE.pollPredictions).insert({
          poll_id: pollId,
          user_id: user?.id || null,
          predicted_count: predNum,
          full_name: predictorName || null,
          contact_info: predictorContact || null,
          ip_address: clientIp,
          device_fingerprint: fingerprint,
        });
      }
    }

    // Award voter participation reward points if applicable
    if (user && poll.voter_reward_points > 0) {
      const awardLabel = `poll_vote_${pollId}`;
      try {
        await publicDb.from(CDILV_TABLE.scoreEvents).insert({
          user_id: user.id,
          points: poll.voter_reward_points,
          note: `Thưởng tham gia bình chọn: ${poll.title} (+${poll.voter_reward_points}đ)`,
          award_label: awardLabel,
        });
      } catch {
        // ignore unique violation
      }
    }

    return NextResponse.json({
      success: true,
      message: "Bình chọn thành công! Cảm ơn bạn đã tham gia.",
    });
  } catch (err: any) {
    console.error("[api/polls/vote] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi gửi bình chọn." },
      { status: 500 },
    );
  }
}
