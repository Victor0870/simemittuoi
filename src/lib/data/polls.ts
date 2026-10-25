import { unstable_cache } from "next/cache";
import { RANKING_REVALIDATE_SECONDS, pollResultsCacheTag } from "@/lib/ranking-cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import type { PollStatus } from "@/lib/polls/phase";
import { normalizeRewardMoney, type RewardMoney } from "@/lib/polls/reward-money";
import { loadPointTally } from "@/lib/polls/points-server";
import {
  normalizeSubmissionMode,
  normalizeVoteMode,
  type PollSubmissionMode,
  type PollVoteMode,
} from "@/lib/polls/vote-mode";

export type JudgeMember = {
  employeeCode: string;
  fullName: string;
  department?: string | null;
  userId?: string | null;
};

export type PollMember = {
  id: string;
  fullName: string;
  employeeCode: string | null;
  userId?: string | null;
};

export type PollOption = {
  id: string;
  pollId: string;
  orderNum: number;
  title: string;
  description: string | null;
  imageUrls: string[];
  voteCount: number;
  finalRank: number | null;
  isActive?: boolean;
  members: PollMember[];
  judgeVotes?: number;
  otherVotes?: number;
  judgeScore?: number;
  otherScore?: number;
  weightedScore?: number;
  lastVoteAt?: string | null;
  firstVoteAt?: string | null;
};

export type PollSummary = {
  id: string;
  title: string;
  description: string | null;
  pollType: "quiz" | "vote";
  accessType: "members_only" | "free";
  contentType: "text" | "image";
  status: PollStatus;
  opensAt: string | null;
  votingEndsAt: string | null;
  isActive: boolean;
  maxVotesPerUser: number;
  maxGuestVotes: number;
  guestVoteCount: number;
  hasPrediction: boolean;
  predictionQuestion: string;
  voterRewardPoints: number;
  entryRewardPoints: number;
  predictorRewardPoints: number;
  isUnionContest: boolean;
  firstPrizePoints: number;
  secondPrizePoints: number;
  thirdPrizePoints: number;
  consolationPrizePoints: number;
  consolationPrizeCount: number;
  rewardMoney: RewardMoney;
  voteMode: PollVoteMode;
  pointsPerParticipant: number;
  pointsPerNonParticipant: number;
  allowSelfVote: boolean;
  submissionMode: PollSubmissionMode;
  submissionDeadline: string | null;
  hasJudges?: boolean;
  judgeWeightPercent?: number;
  judgeList?: JudgeMember[];
  totalJudgesVoted?: number;
  totalOthersVoted?: number;
  winningOptionId: string | null;
  winningPredictorInfo: any | null;
  createdAt: string;
  closedAt: string | null;
  totalVotes?: number;
};

export type PollDetail = PollSummary & {
  options: PollOption[];
};

export async function getPolls(includeInactive = false): Promise<PollSummary[]> {
  const db = createPublicClient();
  const { data, error } = await db
    .from(CDILV_TABLE.polls)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[polls] list error:", error.message);
    return [];
  }

  const all: PollSummary[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    pollType: row.poll_type,
    accessType: row.access_type,
    contentType: row.content_type,
    status: row.status,
    opensAt: row.opens_at ?? null,
    votingEndsAt: row.voting_ends_at ?? null,
    isActive: row.is_active !== false,
    maxVotesPerUser: row.max_votes_per_user ?? 3,
    maxGuestVotes: row.max_guest_votes ?? 250,
    guestVoteCount: row.guest_vote_count ?? 0,
    hasPrediction: Boolean(row.has_prediction),
    predictionQuestion:
      row.prediction_question ||
      "Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?",
    voterRewardPoints: row.voter_reward_points ?? 0,
    entryRewardPoints: row.entry_reward_points ?? 0,
    predictorRewardPoints: row.predictor_reward_points ?? 0,
    isUnionContest: Boolean(row.is_union_contest),
    firstPrizePoints: row.first_prize_points ?? 0,
    secondPrizePoints: row.second_prize_points ?? 0,
    thirdPrizePoints: row.third_prize_points ?? 0,
    consolationPrizePoints: row.consolation_prize_points ?? 0,
    consolationPrizeCount: row.consolation_prize_count ?? 2,
    rewardMoney: normalizeRewardMoney(row.reward_money),
    voteMode: normalizeVoteMode(row.vote_mode),
    pointsPerParticipant: row.points_per_participant ?? 10,
    pointsPerNonParticipant: row.points_per_non_participant ?? 10,
    allowSelfVote: Boolean(row.allow_self_vote),
    submissionMode: normalizeSubmissionMode(row.submission_mode),
    submissionDeadline: row.submission_deadline ?? null,
    hasJudges: Boolean(row.has_judges),
    judgeWeightPercent: row.judge_weight_percent ?? 30,
    judgeList: Array.isArray(row.judge_list)
      ? row.judge_list
      : typeof row.judge_list === "string"
      ? JSON.parse(row.judge_list || "[]")
      : [],
    winningOptionId: row.winning_option_id,
    winningPredictorInfo: row.winning_predictor_info,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  }));

  if (!includeInactive) {
    return all.filter((p) => p.isActive);
  }

  return all;
}

/** Chi tiết + kết quả bình chọn từ cache (làm mới tối đa 15 phút/lần, hoặc ngay khi admin đổi/chốt chương trình). */
export async function getPollById(id: string): Promise<PollDetail | null> {
  try {
    return await unstable_cache(() => getPollByIdUncached(id, true), ["poll-detail", id], {
      revalidate: RANKING_REVALIDATE_SECONDS,
      tags: [pollResultsCacheTag(id)],
    })();
  } catch {
    return getPollByIdUncached(id);
  }
}

/** Đọc trực tiếp DB (không cache). `strict`: ném lỗi thay vì trả dữ liệu thiếu, để không lưu cache kết quả lỗi. */
export async function getPollByIdUncached(id: string, strict = false): Promise<PollDetail | null> {
  const db = createPublicClient();

  const { data: pollRow, error: pollError } = await db
    .from(CDILV_TABLE.polls)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (pollError && strict) throw new Error(pollError.message);
  if (pollError || !pollRow) {
    if (pollError) console.error("[polls] getById error:", pollError.message);
    return null;
  }

  // Load options
  const { data: optionsData, error: optError } = await db
    .from(CDILV_TABLE.pollOptions)
    .select("*")
    .eq("poll_id", id)
    .eq("approval_status", "approved")
    .order("order_num", { ascending: true });

  if (optError && strict) throw new Error(optError.message);
  if (optError) {
    console.error("[polls] getOptions error:", optError.message);
  }

  const optionIds = (optionsData ?? []).map((o) => o.id);

  // Load members
  let membersData: any[] = [];
  if (optionIds.length > 0) {
    const { data: mData } = await db
      .from(CDILV_TABLE.pollOptionMembers)
      .select("*")
      .in("option_id", optionIds);
    membersData = mData ?? [];
  }

  const membersByOption = new Map<string, PollMember[]>();
  for (const m of membersData) {
    const list = membersByOption.get(m.option_id) || [];
    list.push({
      id: m.id,
      fullName: m.full_name,
      employeeCode: m.employee_code,
      userId: m.user_id,
    });
    membersByOption.set(m.option_id, list);
  }

  const hasJudges = Boolean(pollRow.has_judges);
  const judgeWeightPercent = pollRow.judge_weight_percent ?? 30;
  const judgeList = Array.isArray(pollRow.judge_list)
    ? pollRow.judge_list
    : typeof pollRow.judge_list === "string"
    ? JSON.parse(pollRow.judge_list || "[]")
    : [];

  // Fetch vote rows to compute weighted score & timestamps per option
  let totalJudgesVoted = 0;
  let totalOthersVoted = 0;
  const judgeVotesByOpt = new Map<string, number>();
  const otherVotesByOpt = new Map<string, number>();
  const lastVoteAtByOpt = new Map<string, string>();
  const firstVoteAtByOpt = new Map<string, string>();

  const { data: votesData, error: votesError } = await createServiceClient()
    .from(CDILV_TABLE.pollVotes)
    .select("option_id, is_judge, employee_code, user_id, submission_id, created_at")
    .eq("poll_id", id);

  if (votesError && strict) throw new Error(votesError.message);
  if (votesError) {
    console.error("[polls] getVotes error:", votesError.message);
  } else {
    const judgesVotedSet = new Set<string>();
    const othersVotedSet = new Set<string>();

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

      // Track first and last vote timestamps per option
      if (v.created_at) {
        const curLast = lastVoteAtByOpt.get(v.option_id);
        if (!curLast || new Date(v.created_at).getTime() > new Date(curLast).getTime()) {
          lastVoteAtByOpt.set(v.option_id, v.created_at);
        }
        const curFirst = firstVoteAtByOpt.get(v.option_id);
        if (!curFirst || new Date(v.created_at).getTime() < new Date(curFirst).getTime()) {
          firstVoteAtByOpt.set(v.option_id, v.created_at);
        }
      }
    }

    totalJudgesVoted = judgesVotedSet.size;
    totalOthersVoted = othersVotedSet.size;
  }

  // Vote theo point: số "phiếu" của mỗi bài thi là tổng điểm; tỉ lệ BGK/công khai tính trên tổng điểm của từng nhóm.
  const voteMode = normalizeVoteMode(pollRow.vote_mode);
  const pointTotalsByOpt = new Map<string, number>();
  let judgeDenominator = totalJudgesVoted;
  let otherDenominator = totalOthersVoted;
  if (voteMode === "points") {
    try {
      const tally = await loadPointTally(createServiceClient(), id);
      judgeVotesByOpt.clear();
      otherVotesByOpt.clear();
      firstVoteAtByOpt.clear();
      lastVoteAtByOpt.clear();
      tally.judgeByOption.forEach((v, k) => judgeVotesByOpt.set(k, v));
      tally.publicByOption.forEach((v, k) => otherVotesByOpt.set(k, v));
      tally.firstAtByOption.forEach((v, k) => firstVoteAtByOpt.set(k, v));
      tally.lastAtByOption.forEach((v, k) => lastVoteAtByOpt.set(k, v));
      tally.totalByOption.forEach((v, k) => pointTotalsByOpt.set(k, v));
      totalJudgesVoted = tally.judgeVoters;
      totalOthersVoted = tally.publicVoters;
      judgeDenominator = tally.judgePointsTotal;
      otherDenominator = tally.publicPointsTotal;
    } catch (tallyError: any) {
      if (strict) throw tallyError;
      console.error("[polls] getPointTally error:", tallyError?.message);
    }
  }

  const judgeWeight = judgeWeightPercent / 10; // e.g. 30% -> 3.0
  const otherWeight = (100 - judgeWeightPercent) / 10; // e.g. 70% -> 7.0

  const options: PollOption[] = (optionsData ?? []).map((row) => {
    let judgeVotes = 0;
    let otherVotes = 0;
    let judgeScore = 0;
    let otherScore = 0;
    let weightedScore = 0;

    if (hasJudges) {
      judgeVotes = judgeVotesByOpt.get(row.id) || 0;
      otherVotes = otherVotesByOpt.get(row.id) || 0;

      const judgeRatio = judgeDenominator > 0 ? judgeVotes / judgeDenominator : 0;
      const otherRatio = otherDenominator > 0 ? otherVotes / otherDenominator : 0;

      judgeScore = Math.round(judgeRatio * judgeWeight * 100) / 100;
      otherScore = Math.round(otherRatio * otherWeight * 100) / 100;
      weightedScore = Math.round((judgeScore + otherScore) * 100) / 100;
    }

    return {
      id: row.id,
      pollId: row.poll_id,
      orderNum: row.order_num,
      title: row.title,
      description: row.description,
      imageUrls: Array.isArray(row.image_urls)
        ? row.image_urls
        : typeof row.image_urls === "string"
        ? JSON.parse(row.image_urls || "[]")
        : [],
      voteCount: (voteMode === "points" ? pointTotalsByOpt.get(row.id) : undefined) ?? row.vote_count ?? 0,
      finalRank: row.final_rank,
      isActive: row.is_active !== false,
      members: membersByOption.get(row.id) || [],
      judgeVotes,
      otherVotes,
      judgeScore,
      otherScore,
      weightedScore,
      lastVoteAt: lastVoteAtByOpt.get(row.id) || null,
      firstVoteAt: firstVoteAtByOpt.get(row.id) || null,
    };
  });

  const totalVotes = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);

  return {
    id: pollRow.id,
    title: pollRow.title,
    description: pollRow.description,
    pollType: pollRow.poll_type,
    accessType: pollRow.access_type,
    contentType: pollRow.content_type,
    status: pollRow.status,
    opensAt: pollRow.opens_at ?? null,
    votingEndsAt: pollRow.voting_ends_at ?? null,
    isActive: pollRow.is_active !== false,
    maxVotesPerUser: pollRow.max_votes_per_user ?? 3,
    maxGuestVotes: pollRow.max_guest_votes ?? 250,
    guestVoteCount: pollRow.guest_vote_count ?? 0,
    hasPrediction: Boolean(pollRow.has_prediction),
    predictionQuestion:
      pollRow.prediction_question ||
      "Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?",
    voterRewardPoints: pollRow.voter_reward_points ?? 0,
    entryRewardPoints: pollRow.entry_reward_points ?? 0,
    predictorRewardPoints: pollRow.predictor_reward_points ?? 0,
    isUnionContest: Boolean(pollRow.is_union_contest),
    firstPrizePoints: pollRow.first_prize_points ?? 0,
    secondPrizePoints: pollRow.second_prize_points ?? 0,
    thirdPrizePoints: pollRow.third_prize_points ?? 0,
    consolationPrizePoints: pollRow.consolation_prize_points ?? 0,
    consolationPrizeCount: pollRow.consolation_prize_count ?? 2,
    rewardMoney: normalizeRewardMoney(pollRow.reward_money),
    voteMode,
    pointsPerParticipant: pollRow.points_per_participant ?? 10,
    pointsPerNonParticipant: pollRow.points_per_non_participant ?? 10,
    allowSelfVote: Boolean(pollRow.allow_self_vote),
    submissionMode: normalizeSubmissionMode(pollRow.submission_mode),
    submissionDeadline: pollRow.submission_deadline ?? null,
    hasJudges,
    judgeWeightPercent,
    judgeList,
    totalJudgesVoted,
    totalOthersVoted,
    winningOptionId: pollRow.winning_option_id,
    winningPredictorInfo: pollRow.winning_predictor_info,
    createdAt: pollRow.created_at,
    closedAt: pollRow.closed_at,
    totalVotes,
    options,
  };
}
