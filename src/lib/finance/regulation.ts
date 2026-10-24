/**
 * Quy chế chi tiêu: 1 văn bản lưu ở cdilv_app_settings (key SPENDING_REGULATION_KEY).
 * Nội dung là chữ thường với vài cú pháp đơn giản:
 *   # Chương I. TÊN CHƯƠNG   ## Điều 1. Tên điều   ### Mục nhỏ
 *   - gạch đầu dòng          1. danh sách đánh số   **chữ đậm**   ![Ảnh](url)
 */
export const SPENDING_REGULATION_KEY = "spending_regulation";
export const SPENDING_REGULATION_DEFAULT_TITLE = "Quy chế chi tiêu";

export const SPENDING_REGULATION_LIMITS = {
  title: 200,
  regulationNo: 100,
  content: 200_000,
} as const;

export type SpendingRegulation = {
  title: string;
  regulationNo: string;
  /** "YYYY-MM-DD" hoặc null. */
  effectiveDate: string | null;
  content: string;
};

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function oneLine(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function normalizeSpendingRegulation(raw: unknown): SpendingRegulation {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const effectiveDate = typeof data.effectiveDate === "string" && isIsoDate(data.effectiveDate) ? data.effectiveDate : null;
  const content =
    typeof data.content === "string"
      ? data.content.replace(/\r\n?/g, "\n").replace(/\s+$/, "").slice(0, SPENDING_REGULATION_LIMITS.content)
      : "";
  return {
    title: oneLine(data.title, SPENDING_REGULATION_LIMITS.title) || SPENDING_REGULATION_DEFAULT_TITLE,
    regulationNo: oneLine(data.regulationNo, SPENDING_REGULATION_LIMITS.regulationNo),
    effectiveDate,
    content,
  };
}

/** "2026-01-15" → "15/01/2026". */
export function formatRegulationDate(iso: string | null): string {
  return iso ? iso.split("-").reverse().join("/") : "";
}

export type RegulationHeading = {
  /** 1 = Chương (#), 2 = Điều (##), 3 = mục nhỏ (###). */
  level: 1 | 2 | 3;
  text: string;
  /** Số thứ tự dòng (0-based) trong nội dung. */
  line: number;
  /** id neo trên trang đọc. */
  anchor: string;
};

const HEADING_PATTERN = /^(#{1,3})\s+(.+?)\s*$/;

export function parseRegulationHeading(line: string): { level: 1 | 2 | 3; text: string } | null {
  const match = HEADING_PATTERN.exec(line);
  if (!match) return null;
  return { level: match[1].length as 1 | 2 | 3, text: match[2] };
}

export function regulationAnchor(line: number): string {
  return `quy-che-${line + 1}`;
}

export function regulationOutline(content: string): RegulationHeading[] {
  const headings: RegulationHeading[] = [];
  content.split(/\r?\n/).forEach((line, index) => {
    const heading = parseRegulationHeading(line);
    if (heading) headings.push({ ...heading, line: index, anchor: regulationAnchor(index) });
  });
  return headings;
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  let rest = Math.max(1, Math.floor(n));
  let out = "";
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

function fromRoman(text: string): number {
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const current = values[text[i]] ?? 0;
    const next = values[text[i + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return total;
}

/** Số Chương / Điều tiếp theo (Chương đánh số La Mã, Điều đánh số liên tục toàn văn bản). */
export function nextRegulationNumbers(content: string): { chapter: string; article: number } {
  let maxChapter = 0;
  let maxArticle = 0;
  for (const heading of regulationOutline(content)) {
    if (heading.level === 1) {
      const m = /^Chương\s+([IVXLCDM]+|\d+)\b/i.exec(heading.text);
      if (m) maxChapter = Math.max(maxChapter, /^\d+$/.test(m[1]) ? Number(m[1]) : fromRoman(m[1].toUpperCase()));
    } else if (heading.level === 2) {
      const m = /^Điều\s+(\d+)\b/i.exec(heading.text);
      if (m) maxArticle = Math.max(maxArticle, Number(m[1]));
    }
  }
  return { chapter: toRoman(maxChapter + 1), article: maxArticle + 1 };
}
