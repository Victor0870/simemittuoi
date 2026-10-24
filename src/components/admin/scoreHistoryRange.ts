/** Mốc "Từ ngày" của trang Lịch sử cộng điểm: "YYYY-MM-DD" hoặc "all" (không giới hạn). */
export type ScoreHistoryFrom = string;

export const HISTORY_FROM_ALL = "all";
export const HISTORY_DEFAULT_DAYS = 30;

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shiftIsoDate(iso: string, { days = 0, months = 0 }: { days?: number; months?: number }): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay) + days);
  return target.toISOString().slice(0, 10);
}

/** ?from= hợp lệ thì giữ nguyên, "all" = tất cả, còn lại về mặc định hôm nay − 30 ngày. */
export function resolveHistoryFrom(raw: string | string[] | undefined, today: string): ScoreHistoryFrom {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === HISTORY_FROM_ALL) return HISTORY_FROM_ALL;
  if (isIsoDate(value)) return value;
  return shiftIsoDate(today, { days: -HISTORY_DEFAULT_DAYS });
}

export function historyPresets(today: string): { label: string; from: ScoreHistoryFrom }[] {
  return [
    { label: "7 ngày", from: shiftIsoDate(today, { days: -7 }) },
    { label: "30 ngày", from: shiftIsoDate(today, { days: -30 }) },
    { label: "3 tháng", from: shiftIsoDate(today, { months: -3 }) },
    { label: "Từ đầu năm", from: `${today.slice(0, 4)}-01-01` },
    { label: "Tất cả", from: HISTORY_FROM_ALL },
  ];
}
