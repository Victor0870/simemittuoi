/** Danh sách quà thiếu nhi: logic thuần (dùng được ở cả máy chủ và trình duyệt). */

export const GIFT_DEFAULT_MAX_AGE = 16;
export const GIFT_MAX_AGE_LIMIT = 18;

export type GiftFilter = {
  /** Mốc tính tuổi, dạng YYYY-MM-DD. */
  refDate: string;
  /** Lấy các cháu có tuổi tròn tại mốc nhỏ hơn số này. */
  maxAge: number;
};

export type GiftChildParent = {
  memberId: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
};

export type GiftChildItem = {
  key: string;
  fullName: string;
  dateOfBirth: string;
  gender: "male" | "female" | null;
  ageAtRef: number;
  parents: GiftChildParent[];
  /** Cùng họ tên + ngày sinh được khai ở nhiều đoàn viên → đã gộp thành 1 suất. */
  merged: boolean;
};

export type GiftChildSource = {
  childId: string;
  fullName: string;
  dateOfBirth: string;
  gender: "male" | "female" | null;
  parent: GiftChildParent;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

/** Tuổi tròn tại mốc (sinh nhật đúng ngày mốc thì đã đủ tuổi). -1 nếu sinh sau mốc. */
export function ageAt(dateOfBirth: string, refDate: string): number {
  const dob = parseIsoDate(dateOfBirth);
  const ref = parseIsoDate(refDate);
  if (!dob || !ref) return -1;
  let age = ref.y - dob.y;
  if (ref.m < dob.m || (ref.m === dob.m && ref.d < dob.d)) age -= 1;
  return age;
}

/** Ngày sinh sớm nhất (không tính) để còn dưới maxAge tuổi tại mốc: sinh sau ngày này. */
export function earliestBirthExclusive(refDate: string, maxAge: number): string {
  const ref = parseIsoDate(refDate);
  if (!ref) return refDate;
  const y = ref.y - maxAge;
  // 29/02 lùi về năm không nhuận → 28/02 (người sinh 01/03 năm đó vẫn chưa đủ tuổi).
  const lastDay = new Date(Date.UTC(y, ref.m, 0)).getUTCDate();
  const d = Math.min(ref.d, lastDay);
  return `${String(y).padStart(4, "0")}-${String(ref.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function defaultGiftRefDate(now = new Date()): string {
  const year = Number(
    new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(now),
  );
  return `${year}-06-01`;
}

export function parseGiftFilter(
  params: { date?: string | string[]; age?: string | string[] },
  now = new Date(),
): GiftFilter {
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const rawAge = Array.isArray(params.age) ? params.age[0] : params.age;
  const refDate = rawDate && isValidIsoDate(rawDate) ? rawDate : defaultGiftRefDate(now);
  const ageNum = Number(rawAge);
  const maxAge =
    Number.isInteger(ageNum) && ageNum >= 1 && ageNum <= GIFT_MAX_AGE_LIMIT ? ageNum : GIFT_DEFAULT_MAX_AGE;
  return { refDate, maxAge };
}

export function normalizeChildName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

/** Lọc theo mốc + tuổi, gộp cháu trùng (họ tên + ngày sinh), sắp xếp theo bộ phận → bố/mẹ → ngày sinh. */
export function buildChildrenGiftList(sources: GiftChildSource[], filter: GiftFilter): GiftChildItem[] {
  const groups = new Map<string, GiftChildItem>();
  for (const s of sources) {
    const age = ageAt(s.dateOfBirth, filter.refDate);
    if (age < 0 || age >= filter.maxAge) continue;
    const key = `${normalizeChildName(s.fullName)}|${s.dateOfBirth}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.parents.some((p) => p.memberId === s.parent.memberId)) {
        existing.parents.push(s.parent);
      }
      existing.merged = true;
      existing.gender ??= s.gender;
      continue;
    }
    groups.set(key, {
      key,
      fullName: s.fullName.trim().replace(/\s+/g, " "),
      dateOfBirth: s.dateOfBirth,
      gender: s.gender,
      ageAtRef: age,
      parents: [s.parent],
      merged: false,
    });
  }

  const items = [...groups.values()];
  for (const item of items) {
    item.parents.sort((a, b) => collator.compare(a.fullName, b.fullName));
  }
  return items.sort((a, b) => {
    const pa = a.parents[0];
    const pb = b.parents[0];
    return (
      collator.compare(pa.department ?? "", pb.department ?? "") ||
      collator.compare(pa.fullName, pb.fullName) ||
      a.dateOfBirth.localeCompare(b.dateOfBirth)
    );
  });
}

export function formatIsoDateVi(value: string): string {
  const d = parseIsoDate(value);
  if (!d) return value;
  return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
}
