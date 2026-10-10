import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";

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
};

export type PollSummary = {
  id: string;
  title: string;
  description: string | null;
  pollType: "quiz" | "vote";
  accessType: "members_only" | "free";
  contentType: "text" | "image";
  status: "open" | "closed" | "draft";
  isActive: boolean;
  maxVotesPerUser: number;
  hasPrediction: boolean;
  predictionQuestion: string;
  voterRewardPoints: number;
  predictorRewardPoints: number;
  isUnionContest: boolean;
  firstPrizePoints: number;
  secondPrizePoints: number;
  thirdPrizePoints: number;
  consolationPrizePoints: number;
  consolationPrizeCount: number;
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
    isActive: row.is_active !== false,
    maxVotesPerUser: row.max_votes_per_user ?? 3,
    hasPrediction: Boolean(row.has_prediction),
    predictionQuestion:
      row.prediction_question ||
      "Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?",
    voterRewardPoints: row.voter_reward_points ?? 0,
    predictorRewardPoints: row.predictor_reward_points ?? 0,
    isUnionContest: Boolean(row.is_union_contest),
    firstPrizePoints: row.first_prize_points ?? 0,
    secondPrizePoints: row.second_prize_points ?? 0,
    thirdPrizePoints: row.third_prize_points ?? 0,
    consolationPrizePoints: row.consolation_prize_points ?? 0,
    consolationPrizeCount: row.consolation_prize_count ?? 2,
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

export async function getPollById(id: string): Promise<PollDetail | null> {
  const db = createPublicClient();

  const { data: pollRow, error: pollError } = await db
    .from(CDILV_TABLE.polls)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (pollError || !pollRow) {
    if (pollError) console.error("[polls] getById error:", pollError.message);
    return null;
  }

  // Load options
  const { data: optionsData, error: optError } = await db
    .from(CDILV_TABLE.pollOptions)
    .select("*")
    .eq("poll_id", id)
    .order("order_num", { ascending: true });

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

  const options: PollOption[] = (optionsData ?? []).map((row) => ({
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
    voteCount: row.vote_count ?? 0,
    finalRank: row.final_rank,
    isActive: row.is_active !== false,
    members: membersByOption.get(row.id) || [],
  }));

  const totalVotes = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);

  return {
    id: pollRow.id,
    title: pollRow.title,
    description: pollRow.description,
    pollType: pollRow.poll_type,
    accessType: pollRow.access_type,
    contentType: pollRow.content_type,
    status: pollRow.status,
    isActive: pollRow.is_active !== false,
    maxVotesPerUser: pollRow.max_votes_per_user ?? 3,
    hasPrediction: Boolean(pollRow.has_prediction),
    predictionQuestion:
      pollRow.prediction_question ||
      "Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?",
    voterRewardPoints: pollRow.voter_reward_points ?? 0,
    predictorRewardPoints: pollRow.predictor_reward_points ?? 0,
    isUnionContest: Boolean(pollRow.is_union_contest),
    firstPrizePoints: pollRow.first_prize_points ?? 0,
    secondPrizePoints: pollRow.second_prize_points ?? 0,
    thirdPrizePoints: pollRow.third_prize_points ?? 0,
    consolationPrizePoints: pollRow.consolation_prize_points ?? 0,
    consolationPrizeCount: pollRow.consolation_prize_count ?? 2,
    winningOptionId: pollRow.winning_option_id,
    winningPredictorInfo: pollRow.winning_predictor_info,
    createdAt: pollRow.created_at,
    closedAt: pollRow.closed_at,
    totalVotes,
    options,
  };
}
