export const POPUP_TONES = ["info", "urgent", "warning", "success"] as const;
export const POPUP_AUDIENCES = ["members", "all"] as const;
export const POPUP_FREQUENCIES = ["once", "daily", "session"] as const;

export type PopupTone = (typeof POPUP_TONES)[number];
export type PopupAudience = (typeof POPUP_AUDIENCES)[number];
export type PopupFrequency = (typeof POPUP_FREQUENCIES)[number];

export const POPUP_TITLE_MAX = 120;
export const POPUP_BODY_MAX = 1000;
export const POPUP_LINK_LABEL_MAX = 40;

export type PopupContent = {
  title: string;
  body: string;
  tone: PopupTone;
  linkUrl: string | null;
  linkLabel: string | null;
};

/** Popup đang hiện cho người xem (API /api/popups/active). */
export type ActivePopup = PopupContent & {
  id: string;
  frequency: PopupFrequency;
  /** Lần xem gần nhất của người đang đăng nhập (null nếu chưa xem / khách). */
  lastSeenAt: string | null;
};

/** Popup trong trang quản lý. */
export type AdminPopup = PopupContent & {
  id: string;
  audience: PopupAudience;
  frequency: PopupFrequency;
  startsAt: string;
  endsAt: string | null;
  /** Khung giờ mỗi ngày "HH:MM" (giờ VN); null = cả ngày. */
  dailyStart: string | null;
  dailyEnd: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  viewerCount: number;
};

export const POPUP_TONE_META: Record<
  PopupTone,
  { label: string; icon: string; header: string; iconColor: string; button: string; chip: string }
> = {
  info: {
    label: "Thông báo",
    icon: "campaign",
    header: "from-[#173A67] via-[#1E4A7D] to-[#27496D]",
    iconColor: "text-sky-200",
    button: "bg-primary",
    chip: "border-sky-300 bg-sky-50 text-sky-800",
  },
  urgent: {
    label: "Tin gấp",
    icon: "notification_important",
    header: "from-red-700 via-red-600 to-rose-600",
    iconColor: "text-amber-200",
    button: "bg-red-600",
    chip: "border-red-300 bg-red-50 text-red-700",
  },
  warning: {
    label: "Lưu ý",
    icon: "warning",
    header: "from-amber-600 via-amber-500 to-orange-500",
    iconColor: "text-white",
    button: "bg-amber-600",
    chip: "border-amber-300 bg-amber-50 text-amber-800",
  },
  success: {
    label: "Tin vui",
    icon: "celebration",
    header: "from-emerald-700 via-emerald-600 to-teal-600",
    iconColor: "text-amber-200",
    button: "bg-emerald-600",
    chip: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
};

export const POPUP_AUDIENCE_LABEL: Record<PopupAudience, string> = {
  members: "Đoàn viên đã đăng nhập",
  all: "Tất cả người truy cập (cả khách)",
};

export const POPUP_FREQUENCY_LABEL: Record<PopupFrequency, string> = {
  once: "Chỉ 1 lần mỗi người",
  daily: "Mỗi ngày 1 lần",
  session: "Mỗi lần mở trang web",
};

export type PopupStatus = "showing" | "waiting" | "scheduled" | "expired" | "off";

export const POPUP_STATUS_META: Record<PopupStatus, { label: string; chip: string }> = {
  showing: { label: "Đang hiện", chip: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  waiting: { label: "Chờ khung giờ", chip: "border-indigo-300 bg-indigo-50 text-indigo-800" },
  scheduled: { label: "Hẹn giờ", chip: "border-sky-300 bg-sky-50 text-sky-800" },
  expired: { label: "Đã hết hạn", chip: "border-slate-300 bg-slate-100 text-slate-600" },
  off: { label: "Đang tắt", chip: "border-slate-300 bg-slate-100 text-slate-600" },
};

/** Giờ hiện tại theo giờ Việt Nam dạng "HH:MM". */
export function vnClock(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(now));
}

export function isWithinDailyWindow(
  popup: { dailyStart: string | null; dailyEnd: string | null },
  now = Date.now(),
): boolean {
  if (!popup.dailyStart || !popup.dailyEnd) return true;
  const clock = vnClock(now);
  return clock >= popup.dailyStart && clock < popup.dailyEnd;
}

export function getPopupStatus(
  popup: Pick<AdminPopup, "isActive" | "startsAt" | "endsAt" | "dailyStart" | "dailyEnd">,
  now = Date.now(),
): PopupStatus {
  if (!popup.isActive) return "off";
  if (popup.endsAt && new Date(popup.endsAt).getTime() <= now) return "expired";
  if (new Date(popup.startsAt).getTime() > now) return "scheduled";
  if (!isWithinDailyWindow(popup, now)) return "waiting";
  return "showing";
}

/** "07:00:00" (Postgres time) → "07:00". */
export function toClock(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

/** Link trong trang ("/posts/...") hoặc http(s) bên ngoài. */
export function isExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function formatPopupTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export type PopupInput = PopupContent & {
  audience: PopupAudience;
  frequency: PopupFrequency;
  startsAt: string;
  endsAt: string | null;
  dailyStart: string | null;
  dailyEnd: string | null;
  isActive: boolean;
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function parseIso(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Kiểm tra dữ liệu gửi lên; trả về lỗi tiếng Việt hoặc dữ liệu đã chuẩn hóa. */
export function parsePopupInput(raw: unknown): { error: string } | { value: PopupInput } {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = String(data.title ?? "").trim();
  const body = String(data.body ?? "").trim();
  if (!title) return { error: "Vui lòng nhập tiêu đề." };
  if (title.length > POPUP_TITLE_MAX) return { error: `Tiêu đề tối đa ${POPUP_TITLE_MAX} ký tự.` };
  if (!body) return { error: "Vui lòng nhập nội dung." };
  if (body.length > POPUP_BODY_MAX) return { error: `Nội dung tối đa ${POPUP_BODY_MAX} ký tự.` };

  const linkUrl = String(data.linkUrl ?? "").trim() || null;
  const linkLabel = String(data.linkLabel ?? "").trim() || null;
  if (linkUrl) {
    if (linkUrl.length > 500) return { error: "Đường dẫn quá dài." };
    if (!linkUrl.startsWith("/") && !isExternalLink(linkUrl)) {
      return { error: "Đường dẫn phải bắt đầu bằng / (trang trong web) hoặc https://" };
    }
    if (linkUrl.startsWith("//")) return { error: "Đường dẫn không hợp lệ." };
  }
  if (linkLabel && linkLabel.length > POPUP_LINK_LABEL_MAX) {
    return { error: `Chữ trên nút tối đa ${POPUP_LINK_LABEL_MAX} ký tự.` };
  }

  const startsAt = parseIso(data.startsAt) ?? new Date().toISOString();
  const endsAt = data.endsAt ? parseIso(data.endsAt) : null;
  if (data.endsAt && !endsAt) return { error: "Thời gian kết thúc không hợp lệ." };
  if (endsAt && endsAt <= startsAt) return { error: "Thời gian kết thúc phải sau thời gian bắt đầu." };

  const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const dailyStart = String(data.dailyStart ?? "").trim() || null;
  const dailyEnd = String(data.dailyEnd ?? "").trim() || null;
  if (dailyStart || dailyEnd) {
    if (!dailyStart || !dailyEnd) return { error: "Khung giờ mỗi ngày cần đủ giờ bắt đầu và giờ kết thúc." };
    if (!clockPattern.test(dailyStart) || !clockPattern.test(dailyEnd)) {
      return { error: "Khung giờ mỗi ngày không hợp lệ." };
    }
    if (dailyEnd <= dailyStart) return { error: "Giờ kết thúc trong ngày phải sau giờ bắt đầu." };
  }

  return {
    value: {
      title,
      body,
      tone: pick(data.tone, POPUP_TONES, "info"),
      linkUrl,
      linkLabel: linkUrl ? linkLabel : null,
      audience: pick(data.audience, POPUP_AUDIENCES, "members"),
      frequency: pick(data.frequency, POPUP_FREQUENCIES, "once"),
      startsAt,
      endsAt,
      dailyStart,
      dailyEnd,
      isActive: data.isActive !== false,
    },
  };
}

export function popupInputToRow(input: PopupInput) {
  return {
    title: input.title,
    body: input.body,
    tone: input.tone,
    link_url: input.linkUrl,
    link_label: input.linkLabel,
    audience: input.audience,
    frequency: input.frequency,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    daily_start: input.dailyStart,
    daily_end: input.dailyEnd,
    is_active: input.isActive,
  };
}
