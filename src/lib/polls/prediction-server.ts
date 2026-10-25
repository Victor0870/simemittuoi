import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import type { PointVoter } from "@/lib/polls/points-server";

type Predictor = Pick<PointVoter, "employeeCode" | "userId">;

export type PointsPrediction = { value: number; createdAt: string };

export type PredictionRankRow = {
  rank: number;
  name: string;
  predicted: number;
  diff: number;
  submittedAt: string;
};

export type PredictionRanking = {
  actual: number;
  total: number;
  rows: PredictionRankRow[];
};

/** Cùng cách nhận diện người dự đoán như hình thức theo phiếu: theo mã NV, không có mã thì theo tài khoản. */
function contactFor(voter: Predictor): string | null {
  return voter.employeeCode ? `Mã NV: ${voter.employeeCode}` : null;
}

export async function loadPointsPrediction(
  db: SupabaseClient,
  pollId: string,
  voter: Predictor,
): Promise<PointsPrediction | null> {
  const contact = contactFor(voter);
  if (!contact && !voter.userId) return null;
  let query = db
    .from(CDILV_TABLE.pollPredictions)
    .select("predicted_count, created_at")
    .eq("poll_id", pollId);
  query = contact ? query.eq("contact_info", contact) : query.eq("user_id", voter.userId as string);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { value: Number(data.predicted_count), createdAt: String(data.created_at) } : null;
}

export async function deletePointsPrediction(db: SupabaseClient, pollId: string, voter: Predictor) {
  const contact = contactFor(voter);
  if (!contact && !voter.userId) return;
  let query = db.from(CDILV_TABLE.pollPredictions).delete().eq("poll_id", pollId);
  query = contact ? query.eq("contact_info", contact) : query.eq("user_id", voter.userId as string);
  const { error } = await query;
  if (error) throw error;
}

async function predictorName(db: SupabaseClient, voter: Predictor): Promise<string | null> {
  let name: string | null = null;
  if (voter.userId) {
    const { data } = await db.from(CDILV_TABLE.profiles).select("full_name").eq("id", voter.userId).maybeSingle();
    name = data?.full_name?.trim() || null;
  }
  if (!name && voter.employeeCode) {
    const { data } = await db
      .from(CDILV_TABLE.employeeWhitelist)
      .select("full_name")
      .ilike("employee_code", voter.employeeCode)
      .limit(1)
      .maybeSingle();
    name = data?.full_name?.trim() || null;
  }
  return name;
}

/**
 * Ghi dự đoán tổng điểm; mỗi người chỉ giữ một dự đoán.
 * Giữ nguyên thời điểm gửi nếu con số không đổi, để lưu lại điểm bình chọn không làm mất ưu tiên gửi sớm.
 */
export async function savePointsPrediction(
  db: SupabaseClient,
  input: { pollId: string; voter: Predictor; value: number; ipAddress: string; fingerprint: string },
) {
  const { pollId, voter, value } = input;
  const existing = await loadPointsPrediction(db, pollId, voter);
  if (existing && existing.value === value) return;

  const code = voter.employeeCode;
  const name = await predictorName(db, voter);
  await deletePointsPrediction(db, pollId, voter);
  const { error } = await db.from(CDILV_TABLE.pollPredictions).insert({
    poll_id: pollId,
    user_id: voter.userId,
    predicted_count: value,
    full_name: name && code ? `${name} (${code})` : name || (code ? `Mã NV ${code}` : null),
    contact_info: contactFor(voter),
    ip_address: input.ipAddress,
    device_fingerprint: input.fingerprint,
  });
  if (error) throw error;
}

/** Xếp hạng như lúc Đóng & Trao giải: mỗi người lấy dự đoán sau cùng, lệch ít hơn đứng trước, bằng nhau thì gửi sớm hơn. */
export async function loadPredictionRanking(
  db: SupabaseClient,
  pollId: string,
  actual: number,
  limit = 100,
): Promise<PredictionRanking> {
  const { data, error } = await db
    .from(CDILV_TABLE.pollPredictions)
    .select("id, user_id, contact_info, full_name, predicted_count, created_at")
    .eq("poll_id", pollId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const latestByPredictor = new Map<string, NonNullable<typeof data>[number]>();
  for (const p of data ?? []) {
    latestByPredictor.set(p.contact_info || (p.user_id ? `u:${p.user_id}` : `row:${p.id}`), p);
  }
  const sorted = [...latestByPredictor.values()]
    .map((p) => ({ ...p, diff: Math.abs(Number(p.predicted_count) - actual) }))
    .sort((a, b) => {
      if (a.diff !== b.diff) return a.diff - b.diff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  return {
    actual,
    total: sorted.length,
    rows: sorted.slice(0, limit).map((p, i) => ({
      rank: i + 1,
      name: p.full_name || "Người dự đoán",
      predicted: Number(p.predicted_count),
      diff: p.diff,
      submittedAt: String(p.created_at),
    })),
  };
}
