/**
 * Cài đặt dùng chung cho các phiếu in (tên đơn vị, người ký) và mức chi thăm hỏi mặc định.
 * Lưu ở cdilv_app_settings (key = FORM_SETTINGS_KEY). Người ký thay đổi hằng năm nên không cố định trong code.
 */
import { CHAIRMAN_TITLE, normalizeChairmanTitle } from "@/lib/chairman-title";
import { LIFE_EVENT_TYPES } from "@/lib/life-events/registry";

export const FORM_SETTINGS_KEY = "forms";

export type FormSettings = {
  unionName: string;
  chairmanTitle: string;
  chairmanName: string;
  accountantName: string;
  preparerName: string;
  preparerDepartment: string;
  /** Mức chi thăm hỏi mặc định theo loại sự việc (mã trong LIFE_EVENT_TYPES), 0 = chưa đặt. */
  visitAmounts: Record<string, number>;
};

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  unionName: "Công đoàn Công ty TNHH dầu nhờn Idemitsu Việt Nam",
  chairmanTitle: CHAIRMAN_TITLE,
  chairmanName: "",
  accountantName: "",
  preparerName: "",
  preparerDepartment: "",
  visitAmounts: {},
};

export const FORM_TEXT_LIMIT = 120;
export const MAX_AMOUNT = 1_000_000_000;

/** Loại sự việc hiển thị ở bảng mức chi (gồm cả tin buồn do công đoàn lập trực tiếp). */
export const VISIT_AMOUNT_TYPES = LIFE_EVENT_TYPES.map((t) => ({ code: t.code, label: t.label }));

function text(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.trim().replace(/\s+/g, " ").slice(0, FORM_TEXT_LIMIT);
}

export function clampAmount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_AMOUNT);
}

export function normalizeFormSettings(raw: unknown): FormSettings {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const amountsRaw =
    data.visitAmounts && typeof data.visitAmounts === "object" ? (data.visitAmounts as Record<string, unknown>) : {};
  const visitAmounts: Record<string, number> = {};
  for (const t of VISIT_AMOUNT_TYPES) {
    const amount = clampAmount(amountsRaw[t.code]);
    if (amount) visitAmounts[t.code] = amount;
  }
  return {
    unionName: text(data.unionName, DEFAULT_FORM_SETTINGS.unionName) || DEFAULT_FORM_SETTINGS.unionName,
    chairmanTitle: normalizeChairmanTitle(
      text(data.chairmanTitle, DEFAULT_FORM_SETTINGS.chairmanTitle) || DEFAULT_FORM_SETTINGS.chairmanTitle,
    ),
    chairmanName: text(data.chairmanName, ""),
    accountantName: text(data.accountantName, ""),
    preparerName: text(data.preparerName, ""),
    preparerDepartment: text(data.preparerDepartment, ""),
    visitAmounts,
  };
}
