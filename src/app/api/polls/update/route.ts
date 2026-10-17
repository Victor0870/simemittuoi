import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
    const { data: me } = await publicDb
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (me?.role !== "admin" || me?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên mới có quyền cập nhật chương trình bình chọn." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      pollId,
      title,
      description,
      pollType = "vote",
      accessType = "free",
      contentType = "image",
      status,
      maxVotesPerUser = 3,
      hasPrediction = true,
      predictionQuestion,
      voterRewardPoints = 10,
      predictorRewardPoints = 50,
      isUnionContest = true,
      firstPrizePoints = 50,
      secondPrizePoints = 40,
      thirdPrizePoints = 30,
      consolationPrizePoints = 20,
      consolationPrizeCount = 2,
      maxGuestVotes = 250,
      isActive,
      hasJudges,
      judgeWeightPercent,
      judgeList,
      options = [],
    } = body;

    if (!pollId) {
      return NextResponse.json({ error: "Thiếu ID chương trình bình chọn." }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập tên chương trình." }, { status: 400 });
    }

    if (!Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: "Chương trình bình chọn cần có ít nhất 2 tác phẩm/lựa chọn." },
        { status: 400 },
      );
    }

    // 1. Update poll master record
    const updateData: any = {
      title: title.trim(),
      description: description?.trim() || null,
      poll_type: pollType,
      access_type: accessType,
      content_type: contentType,
      max_votes_per_user: parseInt(String(maxVotesPerUser), 10) || 3,
      max_guest_votes: parseInt(String(maxGuestVotes), 10) || 250,
      has_prediction: Boolean(hasPrediction),
      prediction_question:
        predictionQuestion?.trim() ||
        "Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?",
      voter_reward_points: parseInt(String(voterRewardPoints), 10) || 0,
      predictor_reward_points: parseInt(String(predictorRewardPoints), 10) || 0,
      is_union_contest: Boolean(isUnionContest),
      first_prize_points: parseInt(String(firstPrizePoints), 10) || 0,
      second_prize_points: parseInt(String(secondPrizePoints), 10) || 0,
      third_prize_points: parseInt(String(thirdPrizePoints), 10) || 0,
      consolation_prize_points: parseInt(String(consolationPrizePoints), 10) || 0,
      consolation_prize_count: parseInt(String(consolationPrizeCount), 10) || 2,
    };

    if (typeof hasJudges === "boolean") {
      updateData.has_judges = hasJudges;
    }
    if (typeof judgeWeightPercent !== "undefined") {
      updateData.judge_weight_percent = Math.min(
        95,
        Math.max(5, parseInt(String(judgeWeightPercent), 10) || 30),
      );
    }
    if (Array.isArray(judgeList)) {
      updateData.judge_list = judgeList;
    }

    if (typeof isActive === "boolean") {
      updateData.is_active = isActive;
    }

    if (status && ["open", "closed", "draft"].includes(status)) {
      updateData.status = status;
    }

    const { error: pollUpdateErr } = await publicDb
      .from(CDILV_TABLE.polls)
      .update(updateData)
      .eq("id", pollId);

    if (pollUpdateErr) {
      throw pollUpdateErr;
    }

    // 2. Fetch existing options
    const { data: existingOptions } = await publicDb
      .from(CDILV_TABLE.pollOptions)
      .select("id")
      .eq("poll_id", pollId);

    const existingOptionIds = (existingOptions ?? []).map((o) => o.id);
    const incomingOptionIds = options.map((o) => o.id).filter(Boolean);

    // Delete options that were removed
    const toDeleteIds = existingOptionIds.filter((id) => !incomingOptionIds.includes(id));
    if (toDeleteIds.length > 0) {
      await publicDb.from(CDILV_TABLE.pollOptions).delete().in("id", toDeleteIds);
    }

    // 3. Upsert options & members
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      let optId = opt.id;

      if (optId && existingOptionIds.includes(optId)) {
        // Update existing option
        await publicDb
          .from(CDILV_TABLE.pollOptions)
          .update({
            order_num: i + 1,
            title: opt.title?.trim() || `Tác phẩm ${i + 1}`,
            description: opt.description?.trim() || null,
            image_urls: opt.imageUrls || [],
            is_active: opt.isActive !== false,
          })
          .eq("id", optId);
      } else {
        // Insert new option
        const { data: newOpt, error: insErr } = await publicDb
          .from(CDILV_TABLE.pollOptions)
          .insert({
            poll_id: pollId,
            order_num: i + 1,
            title: opt.title?.trim() || `Tác phẩm ${i + 1}`,
            description: opt.description?.trim() || null,
            image_urls: opt.imageUrls || [],
            is_active: opt.isActive !== false,
          })
          .select("id")
          .single();

        if (insErr || !newOpt) continue;
        optId = newOpt.id;
      }

      // Re-populate members for this option
      await publicDb.from(CDILV_TABLE.pollOptionMembers).delete().eq("option_id", optId);

      if (Array.isArray(opt.members) && opt.members.length > 0) {
        for (const m of opt.members) {
          if (!m.fullName || !m.fullName.trim()) continue;
          await publicDb.from(CDILV_TABLE.pollOptionMembers).insert({
            option_id: optId,
            full_name: m.fullName.trim(),
            employee_code: m.employeeCode?.trim() || null,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Cập nhật cài đặt chương trình bình chọn thành công!",
    });
  } catch (err: any) {
    console.error("[api/polls/update] error:", err);
    return NextResponse.json(
      { error: err?.message || "Đã xảy ra lỗi khi cập nhật chương trình." },
      { status: 500 },
    );
  }
}
