export type RewardKind = "first" | "second" | "third" | "consolation" | "entry" | "predictor";

export type RewardMoney = Record<RewardKind, number> & {
  /** Thành viên đội đạt giải có nhận thêm tiền tham gia dự thi hay không. */
  entryForWinners: boolean;
};

export type RewardItem = { kind: RewardKind; label: string };

export type PollRewardRow = {
  employeeCode: string;
  fullName: string;
  bankAccountNo: string;
  bankName: string;
  items: RewardItem[];
};

export const REWARD_KINDS: { kind: RewardKind; label: string }[] = [
  { kind: "first", label: "Giải Nhất" },
  { kind: "second", label: "Giải Nhì" },
  { kind: "third", label: "Giải Ba" },
  { kind: "consolation", label: "Giải Khuyến khích" },
  { kind: "entry", label: "Tham gia dự thi" },
  { kind: "predictor", label: "Dự đoán chính xác nhất" },
];

export const EMPTY_REWARD_MONEY: RewardMoney = {
  first: 0,
  second: 0,
  third: 0,
  consolation: 0,
  entry: 0,
  predictor: 0,
  entryForWinners: true,
};

const MAX_AMOUNT = 1_000_000_000;

export function normalizeRewardMoney(raw: unknown): RewardMoney {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const result: RewardMoney = { ...EMPTY_REWARD_MONEY };
  for (const { kind } of REWARD_KINDS) {
    const n = Math.round(Number(data[kind]));
    result[kind] = Number.isFinite(n) ? Math.min(MAX_AMOUNT, Math.max(0, n)) : 0;
  }
  result.entryForWinners = data.entryForWinners !== false;
  return result;
}

const PRIZE_KINDS = new Set<RewardKind>(["first", "second", "third", "consolation"]);

/** Các khoản được tính tiền của một người (bỏ tiền tham gia nếu đã đạt giải và cài đặt không cộng thêm). */
export function payableItems(items: RewardItem[], money: RewardMoney): RewardItem[] {
  const isWinner = items.some((i) => PRIZE_KINDS.has(i.kind));
  return items.filter((i) => i.kind !== "entry" || money.entryForWinners || !isWinner);
}

export function rowTotal(items: RewardItem[], money: RewardMoney): number {
  return payableItems(items, money).reduce((sum, i) => sum + money[i.kind], 0);
}

export function formatVnd(value: number): string {
  return value.toLocaleString("vi-VN");
}
