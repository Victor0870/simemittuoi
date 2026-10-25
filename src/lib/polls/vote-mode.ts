export type PollVoteMode = "standard" | "points";

export const VOTE_MODE_LABEL: Record<PollVoteMode, string> = {
  standard: "Bình chọn theo phiếu",
  points: "Vote theo point",
};

export const POINTS_BUDGET_MAX = 100000;
export const POINTS_DEFAULT = 10;

export function normalizeVoteMode(raw: unknown): PollVoteMode {
  return raw === "points" ? "points" : "standard";
}

export function normalizePointsBudget(raw: unknown, fallback = POINTS_DEFAULT): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(POINTS_BUDGET_MAX, Math.max(0, Math.floor(n)));
}

export type PointsVoterKind = "individual" | "team";

export const POINTS_REASON_MESSAGE: Record<string, string> = {
  over_budget: "Tổng điểm vượt quá số điểm bạn được phân bổ.",
  self_vote_blocked: "Chương trình không cho bình chọn điểm cho đội/bài thi của chính mình.",
  option_invalid: "Có bài thi không thuộc chương trình hoặc đã bị ẩn. Vui lòng tải lại trang.",
  allocation_invalid: "Số điểm phải là số nguyên không âm.",
  not_points_mode: "Chương trình này không dùng hình thức Vote theo point.",
  poll_closed: "Chương trình bình chọn đã kết thúc hoặc đang tạm ngưng.",
  poll_not_found: "Không tìm thấy chương trình bình chọn.",
  voter_invalid: "Không xác định được người bình chọn.",
};

export function pointsReasonMessage(reason: unknown): string {
  return POINTS_REASON_MESSAGE[String(reason ?? "")] || "Không lưu được điểm bình chọn.";
}
