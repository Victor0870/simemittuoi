import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";
import {
  approvedAccountOwnsCode,
  isValidJudgeToken,
  judgeCodesFromPoll,
  normalizeEmployeeCode,
} from "@/lib/polls/judge-access";

export type PointTally = {
  judgeByOption: Map<string, number>;
  publicByOption: Map<string, number>;
  totalByOption: Map<string, number>;
  firstAtByOption: Map<string, string>;
  lastAtByOption: Map<string, string>;
  judgeVoters: number;
  publicVoters: number;
  judgePointsTotal: number;
  publicPointsTotal: number;
};

/** Cộng điểm theo bài thi, tách điểm BGK và điểm bình chọn công khai. */
export async function loadPointTally(db: SupabaseClient, pollId: string): Promise<PointTally> {
  const { data, error } = await db
    .from(CDILV_TABLE.pollPointAllocations)
    .select("option_id, voter_key, is_judge, points, created_at, updated_at")
    .eq("poll_id", pollId);
  if (error) throw error;

  const tally: PointTally = {
    judgeByOption: new Map(),
    publicByOption: new Map(),
    totalByOption: new Map(),
    firstAtByOption: new Map(),
    lastAtByOption: new Map(),
    judgeVoters: 0,
    publicVoters: 0,
    judgePointsTotal: 0,
    publicPointsTotal: 0,
  };
  const judgeKeys = new Set<string>();
  const publicKeys = new Set<string>();

  for (const row of data ?? []) {
    const points = Number(row.points) || 0;
    const optionId = String(row.option_id);
    if (row.is_judge) {
      judgeKeys.add(row.voter_key);
      tally.judgeByOption.set(optionId, (tally.judgeByOption.get(optionId) || 0) + points);
      tally.judgePointsTotal += points;
    } else {
      publicKeys.add(row.voter_key);
      tally.publicByOption.set(optionId, (tally.publicByOption.get(optionId) || 0) + points);
      tally.publicPointsTotal += points;
    }
    tally.totalByOption.set(optionId, (tally.totalByOption.get(optionId) || 0) + points);

    const first = tally.firstAtByOption.get(optionId);
    if (row.created_at && (!first || new Date(row.created_at) < new Date(first))) {
      tally.firstAtByOption.set(optionId, row.created_at);
    }
    const lastSource = row.updated_at || row.created_at;
    const last = tally.lastAtByOption.get(optionId);
    if (lastSource && (!last || new Date(lastSource) > new Date(last))) {
      tally.lastAtByOption.set(optionId, lastSource);
    }
  }

  tally.judgeVoters = judgeKeys.size;
  tally.publicVoters = publicKeys.size;
  return tally;
}

export type PointVoter = {
  isJudge: boolean;
  employeeCode: string | null;
  /** Chỉ có khi là đoàn viên đã duyệt đang đăng nhập (khách nhập mã thì không gắn tài khoản). */
  userId: string | null;
  needsEmployeeCode: boolean;
  isPrivateJudgeVote: boolean;
};

export type ResolveResult =
  | { voter: PointVoter; error?: undefined; status?: undefined; needsEmployeeCode?: undefined }
  | { voter?: undefined; error: string; status: number; needsEmployeeCode?: boolean };

const PUBLIC_JUDGE_BLOCKED =
  "Mã này thuộc Ban giám khảo chưa có tài khoản nên không bình chọn được qua link công khai. Vui lòng dùng link riêng do ban tổ chức gửi. Nếu bạn đã có tài khoản đoàn viên, hãy đăng nhập.";
const PRIVATE_JUDGE_ONLY =
  "Link này chỉ dành cho Ban giám khảo chưa có tài khoản. Mã nhân viên không có trong danh sách giám khảo.";
const PRIVATE_JUDGE_HAS_ACCOUNT =
  "Giám khảo đã có tài khoản đoàn viên. Vui lòng đăng nhập rồi bình chọn, không dùng link riêng này.";

/**
 * Xác định người bầu theo đúng quy tắc của hình thức bình chọn theo phiếu:
 * đoàn viên đã duyệt dùng mã trên hồ sơ; chương trình tự do thì khách nhập mã nhân viên;
 * giám khảo chưa có tài khoản chỉ bầu qua link riêng (?gk=).
 * Ngân sách, người dự thi và tự vote do hàm cơ sở dữ liệu tính theo mã nhân viên / tài khoản.
 */
export async function resolvePointVoter(
  db: SupabaseClient,
  poll: Record<string, any>,
  input: { employeeCode?: unknown; judgeToken?: unknown },
): Promise<ResolveResult> {
  const pollId = String(poll.id);
  const judgeCodes = judgeCodesFromPoll(poll);
  const judgeLinkOk = Boolean(poll.has_judges) && (await isValidJudgeToken(db, pollId, input.judgeToken));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let memberEmployeeCode: string | null = null;
  let isApprovedMember = false;
  if (user) {
    const { data: profile } = await supabase
      .from(CDILV_TABLE.profiles)
      .select("approval_status, employee_code")
      .eq("id", user.id)
      .maybeSingle();
    isApprovedMember = profile?.approval_status === "approved";
    memberEmployeeCode = normalizeEmployeeCode(profile?.employee_code);
  }

  if (poll.access_type === "members_only" && !isApprovedMember && !judgeLinkOk) {
    return { error: "Chương trình này chỉ dành riêng cho đoàn viên đã đăng nhập.", status: 401 };
  }

  const needsEmployeeCode = !isApprovedMember && (poll.access_type === "free" || judgeLinkOk);
  const employeeCode = needsEmployeeCode ? normalizeEmployeeCode(input.employeeCode) : memberEmployeeCode;

  if (needsEmployeeCode && !employeeCode) {
    return {
      error: "Vui lòng nhập mã nhân viên trước khi bình chọn.",
      status: 400,
      needsEmployeeCode: true,
    };
  }

  const codeIsJudge = Boolean(employeeCode && judgeCodes.has(employeeCode));
  const codeHasApprovedAccount =
    needsEmployeeCode && codeIsJudge && employeeCode ? await approvedAccountOwnsCode(db, employeeCode) : false;

  if (needsEmployeeCode && codeIsJudge && !judgeLinkOk) {
    return { error: PUBLIC_JUDGE_BLOCKED, status: 403 };
  }
  if (judgeLinkOk && needsEmployeeCode) {
    if (!codeIsJudge) return { error: PRIVATE_JUDGE_ONLY, status: 403 };
    if (codeHasApprovedAccount) return { error: PRIVATE_JUDGE_HAS_ACCOUNT, status: 403 };
  }

  const isPrivateJudgeVote = judgeLinkOk && needsEmployeeCode && codeIsJudge && !codeHasApprovedAccount;
  const userId = isApprovedMember && user ? user.id : null;
  if (!employeeCode && !userId) {
    return { error: "Không xác định được người bình chọn.", status: 400 };
  }

  return {
    voter: {
      isJudge: codeIsJudge && (!needsEmployeeCode || isPrivateJudgeVote),
      employeeCode,
      userId,
      needsEmployeeCode,
      isPrivateJudgeVote,
    },
  };
}

export type VoterBudget = {
  voterKey: string;
  isParticipant: boolean;
  memberOptionIds: string[];
  allowSelfVote: boolean;
  base: number;
  granted: number;
  budget: number;
  used: number;
  allocations: Record<string, number>;
};

export async function loadVoterBudget(
  db: SupabaseClient,
  pollId: string,
  voter: Pick<PointVoter, "employeeCode" | "userId">,
) {
  const { data, error } = await db.rpc(CDILV_RPC.pollPointsBudget, {
    p_poll_id: pollId,
    p_employee_code: voter.employeeCode,
    p_user_id: voter.userId,
  });
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, any>;
  if (!raw.ok) throw new Error("Không xác định được ngân sách điểm.");

  const { data: grants, error: grantsError } = await db
    .from(CDILV_TABLE.pollPointGrants)
    .select("points, reason, created_at")
    .eq("poll_id", pollId)
    .eq("voter_key", raw.voterKey)
    .order("created_at", { ascending: true });
  if (grantsError) throw grantsError;

  const allocations: Record<string, number> = {};
  for (const [optionId, points] of Object.entries((raw.allocations ?? {}) as Record<string, unknown>)) {
    allocations[optionId] = Number(points) || 0;
  }

  const budget: VoterBudget = {
    voterKey: String(raw.voterKey),
    isParticipant: Boolean(raw.isParticipant),
    memberOptionIds: Array.isArray(raw.memberOptionIds) ? raw.memberOptionIds.map(String) : [],
    allowSelfVote: Boolean(raw.allowSelfVote),
    base: Number(raw.base) || 0,
    granted: Number(raw.granted) || 0,
    budget: Number(raw.budget) || 0,
    used: Number(raw.used) || 0,
    allocations,
  };

  return {
    ...budget,
    grants: (grants ?? []).map((g) => ({
      points: Number(g.points) || 0,
      reason: String(g.reason ?? ""),
      createdAt: g.created_at as string,
    })),
  };
}
