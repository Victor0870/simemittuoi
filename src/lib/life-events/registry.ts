/**
 * Báo tin từ đoàn viên: danh mục nhóm tin, loại sự việc, quan hệ với người liên quan.
 * Thêm loại mới chỉ cần thêm vào LIFE_EVENT_TYPES (mã đã lưu trong database thì không đổi).
 */

export type LifeEventCategory = "happy" | "sad" | "sick" | "other";
export type LifeEventStatus = "submitted" | "acknowledged" | "withdrawn";

export type Relation =
  | "self"
  | "spouse"
  | "child"
  | "father"
  | "mother"
  | "father_in_law"
  | "mother_in_law"
  | "other";

export const RELATION_LABEL: Record<Relation, string> = {
  self: "Bản thân",
  spouse: "Vợ / chồng",
  child: "Con",
  father: "Bố đẻ",
  mother: "Mẹ đẻ",
  father_in_law: "Bố vợ / bố chồng",
  mother_in_law: "Mẹ vợ / mẹ chồng",
  other: "Người thân khác",
};

export type CategoryDef = {
  key: LifeEventCategory;
  label: string;
  short: string;
  icon: string;
  hint: string;
  /** Lớp màu cho thẻ / nhãn. */
  tone: string;
  /** Đoàn viên được tự báo trực tuyến (tin buồn do công đoàn nắm và xử lý trực tiếp). */
  memberSubmittable: boolean;
};

export const LIFE_EVENT_CATEGORIES: CategoryDef[] = [
  {
    key: "happy",
    label: "Báo tin vui",
    short: "Tin vui",
    icon: "celebration",
    hint: "Kết hôn, sinh con…",
    tone: "bg-rose-50 text-rose-700 border-rose-200",
    memberSubmittable: true,
  },
  {
    key: "sad",
    label: "Báo tin buồn",
    short: "Tin buồn",
    icon: "local_florist",
    hint: "Hiếu: tứ thân phụ mẫu, vợ / chồng, con",
    tone: "bg-slate-100 text-slate-700 border-slate-300",
    memberSubmittable: false,
  },
  {
    key: "sick",
    label: "Báo tin ốm",
    short: "Tin ốm",
    icon: "medical_services",
    hint: "Ốm đau, nằm viện, tai nạn (kèm giấy ốm / giấy ra viện)",
    tone: "bg-sky-50 text-sky-700 border-sky-200",
    memberSubmittable: true,
  },
  {
    key: "other",
    label: "Báo tin khác",
    short: "Tin khác",
    icon: "campaign",
    hint: "Khó khăn đột xuất, thiên tai, hỏa hoạn…",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
    memberSubmittable: true,
  },
];

export const MEMBER_LIFE_EVENT_CATEGORIES = LIFE_EVENT_CATEGORIES.filter((c) => c.memberSubmittable);

export const CATEGORY_BY_KEY = Object.fromEntries(LIFE_EVENT_CATEGORIES.map((c) => [c.key, c])) as Record<
  LifeEventCategory,
  CategoryDef
>;

export type LifeEventTypeDef = {
  code: string;
  category: LifeEventCategory;
  label: string;
  relations: Relation[];
  /** Nhãn ô họ tên người liên quan (khi không phải bản thân). */
  subjectNameLabel?: string;
  subjectNameOptional?: boolean;
  dateLabel: string;
  locationLabel?: string;
  attachmentHint: string;
};

const PARENTS: Relation[] = ["father", "mother", "father_in_law", "mother_in_law"];
const FAMILY: Relation[] = ["self", "spouse", "child", ...PARENTS];

export const LIFE_EVENT_TYPES: LifeEventTypeDef[] = [
  {
    code: "marriage",
    category: "happy",
    label: "Kết hôn",
    relations: ["self"],
    dateLabel: "Ngày cưới",
    locationLabel: "Địa điểm tổ chức",
    attachmentHint: "Giấy đăng ký kết hôn hoặc thiệp cưới",
  },
  {
    code: "childbirth",
    category: "happy",
    label: "Sinh con",
    relations: ["child"],
    subjectNameLabel: "Tên bé (nếu đã đặt)",
    subjectNameOptional: true,
    dateLabel: "Ngày sinh của bé",
    locationLabel: "Nơi sinh (bệnh viện)",
    attachmentHint: "Giấy chứng sinh / giấy khai sinh",
  },
  {
    code: "happy_other",
    category: "happy",
    label: "Tin vui khác",
    relations: FAMILY,
    subjectNameLabel: "Họ tên người liên quan",
    dateLabel: "Ngày diễn ra",
    locationLabel: "Địa điểm",
    attachmentHint: "Ảnh giấy tờ liên quan (nếu có)",
  },
  {
    code: "funeral",
    category: "sad",
    label: "Hiếu (người thân mất)",
    relations: ["spouse", "child", ...PARENTS],
    subjectNameLabel: "Họ tên người mất",
    dateLabel: "Ngày mất",
    locationLabel: "Nơi tổ chức tang lễ",
    attachmentHint: "Giấy báo tử hoặc cáo phó",
  },
  {
    code: "illness",
    category: "sick",
    label: "Ốm đau / nằm viện",
    relations: FAMILY,
    subjectNameLabel: "Họ tên người ốm",
    dateLabel: "Ngày bắt đầu ốm / nhập viện",
    locationLabel: "Nơi điều trị",
    attachmentHint: "Giấy ốm, giấy ra viện, giấy chuyển viện…",
  },
  {
    code: "accident",
    category: "sick",
    label: "Tai nạn",
    relations: FAMILY,
    subjectNameLabel: "Họ tên người bị nạn",
    dateLabel: "Ngày xảy ra",
    locationLabel: "Nơi điều trị",
    attachmentHint: "Giấy ra viện, biên bản tai nạn (nếu có)",
  },
  {
    code: "hardship",
    category: "other",
    label: "Khó khăn đột xuất",
    relations: ["self"],
    dateLabel: "Ngày xảy ra",
    locationLabel: "Địa điểm",
    attachmentHint: "Ảnh hiện trường / giấy xác nhận (nếu có)",
  },
  {
    code: "other",
    category: "other",
    label: "Khác",
    relations: FAMILY,
    subjectNameLabel: "Họ tên người liên quan",
    dateLabel: "Ngày xảy ra",
    locationLabel: "Địa điểm",
    attachmentHint: "Ảnh giấy tờ liên quan (nếu có)",
  },
];

export const TYPE_BY_CODE = Object.fromEntries(LIFE_EVENT_TYPES.map((t) => [t.code, t])) as Record<
  string,
  LifeEventTypeDef
>;

export function typesOfCategory(category: LifeEventCategory): LifeEventTypeDef[] {
  return LIFE_EVENT_TYPES.filter((t) => t.category === category);
}

export function isLifeEventCategory(value: unknown): value is LifeEventCategory {
  return typeof value === "string" && value in CATEGORY_BY_KEY;
}

export function isMemberSubmittableCategory(value: unknown): value is LifeEventCategory {
  return isLifeEventCategory(value) && CATEGORY_BY_KEY[value].memberSubmittable;
}

export const STATUS_LABEL: Record<LifeEventStatus, string> = {
  submitted: "Chờ tiếp nhận",
  acknowledged: "Đã tiếp nhận",
  withdrawn: "Đã rút lại",
};

export const STATUS_TONE: Record<LifeEventStatus, string> = {
  submitted: "bg-amber-100 text-amber-900",
  acknowledged: "bg-[#D9F2EC] text-[#173A67]",
  withdrawn: "bg-slate-200 text-slate-600",
};

export const LOG_ACTION_LABEL: Record<string, string> = {
  created: "Gửi tin báo",
  acknowledged: "Tiếp nhận",
  withdrawn: "Rút lại tin báo",
  note: "Ghi chú",
  attachment_added: "Bổ sung giấy tờ",
  attachment_removed: "Xóa giấy tờ",
};

export const LIFE_EVENT_LIMITS = {
  subjectName: 120,
  location: 300,
  description: 2000,
  note: 1000,
  maxAttachments: 6,
  /** Dưới giới hạn body 4,5 MB của Vercel. */
  maxFileBytes: 4 * 1024 * 1024,
} as const;

export const ATTACHMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export type LifeEventInput = {
  category: LifeEventCategory;
  eventType: string;
  relation: Relation;
  subjectName: string | null;
  eventDate: string;
  location: string | null;
  description: string | null;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/[ \t]+/g, " ");
  return trimmed ? trimmed : null;
}

/** Kiểm tra dữ liệu form (dùng ở cả trình duyệt và API). */
export function parseLifeEventInput(
  raw: Record<string, unknown>,
  today: string,
): { ok: true; value: LifeEventInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const type = TYPE_BY_CODE[String(raw.eventType ?? "")];
  if (!type) return { ok: false, errors: ["Vui lòng chọn loại sự việc."] };
  if (raw.category !== undefined && raw.category !== type.category) errors.push("Loại sự việc không khớp nhóm tin.");

  const relation = String(raw.relation ?? "") as Relation;
  if (!type.relations.includes(relation)) errors.push("Vui lòng chọn người liên quan.");

  const subjectName = cleanText(raw.subjectName);
  const needsName = relation !== "self" && !type.subjectNameOptional;
  if (needsName && !subjectName) errors.push(`Vui lòng nhập ${(type.subjectNameLabel ?? "họ tên").toLowerCase()}.`);
  if (subjectName && subjectName.length > LIFE_EVENT_LIMITS.subjectName) errors.push("Họ tên quá dài.");

  const eventDate = String(raw.eventDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(`${eventDate}T00:00:00Z`))) {
    errors.push(`Vui lòng chọn ${type.dateLabel.toLowerCase()}.`);
  } else if (eventDate > today && type.category !== "happy") {
    errors.push(`${type.dateLabel} không được sau hôm nay.`);
  } else if (eventDate < "2000-01-01") {
    errors.push(`${type.dateLabel} không hợp lệ.`);
  }

  const location = cleanText(raw.location);
  if (location && location.length > LIFE_EVENT_LIMITS.location) errors.push("Địa điểm quá dài.");
  const description = typeof raw.description === "string" ? raw.description.trim() || null : null;
  if (description && description.length > LIFE_EVENT_LIMITS.description) {
    errors.push(`Mô tả tối đa ${LIFE_EVENT_LIMITS.description} ký tự.`);
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      category: type.category,
      eventType: type.code,
      relation,
      subjectName: relation === "self" ? null : subjectName,
      eventDate,
      location,
      description,
    },
  };
}

export function todayInVietnam(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

/** "Bố đẻ: Nguyễn Văn A" */
export function describeSubject(relation: string, subjectName: string | null): string {
  const rel = RELATION_LABEL[relation as Relation] ?? relation;
  return subjectName ? `${rel}: ${subjectName}` : rel;
}
