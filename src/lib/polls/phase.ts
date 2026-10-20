export type PollStatus = "open" | "closed" | "draft" | "upcoming";

/**
 * Giai đoạn thực tế của chương trình bình chọn tại một thời điểm:
 * - upcoming: đã công bố, chỉ cho bình chọn thử (không ghi nhận).
 * - open: đang nhận phiếu thật.
 * - ended: hết giờ nhận phiếu, chờ ban tổ chức đóng & trao giải.
 * - closed: đã đóng & trao giải.
 */
export type PollPhase = "upcoming" | "open" | "ended" | "closed";

export type PollPhaseInput = {
  status: PollStatus | string;
  opensAt?: string | null;
  votingEndsAt?: string | null;
};

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function getPollPhase(poll: PollPhaseInput, now: number = Date.now()): PollPhase {
  if (poll.status === "closed") return "closed";
  const opensAt = toMs(poll.opensAt);
  if (poll.status === "upcoming" && (opensAt === null || now < opensAt)) return "upcoming";
  const endsAt = toMs(poll.votingEndsAt);
  if (endsAt !== null && now >= endsAt) return "ended";
  return "open";
}

/** Mốc thời gian tiếp theo làm đổi giai đoạn (để giao diện tự chuyển). */
export function getNextPhaseChangeAt(poll: PollPhaseInput, now: number = Date.now()): number | null {
  const phase = getPollPhase(poll, now);
  if (phase === "upcoming") return toMs(poll.opensAt);
  if (phase === "open") return toMs(poll.votingEndsAt);
  return null;
}

export const POLL_PHASE_META: Record<
  PollPhase,
  { label: string; icon: string; chip: string }
> = {
  upcoming: {
    label: "Sắp mở",
    icon: "schedule",
    chip: "bg-sky-100 text-sky-800 border-sky-300",
  },
  open: {
    label: "Đang mở bình chọn",
    icon: "how_to_vote",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  ended: {
    label: "Hết giờ nhận phiếu",
    icon: "hourglass_bottom",
    chip: "bg-amber-100 text-amber-900 border-amber-300",
  },
  closed: {
    label: "Đã kết thúc",
    icon: "emoji_events",
    chip: "bg-slate-100 text-slate-700 border-slate-300",
  },
};

export function formatPollTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d} ngày ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function parseOptionalIso(value: unknown): string | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "invalid";
}

export type PollScheduleMode = "open" | "upcoming";

export type PollSchedule = {
  mode: PollScheduleMode;
  opensAt: string | null;
  votingEndsAt: string | null;
};

/** Đọc lịch bình chọn từ body API; trả về null nếu body không gửi lịch. */
export function parsePollSchedule(
  body: Record<string, unknown>,
): { ok: true; value: PollSchedule | null } | { ok: false; error: string } {
  const mode = body.scheduleMode;
  if (mode === undefined) return { ok: true, value: null };
  if (mode !== "open" && mode !== "upcoming") {
    return { ok: false, error: "Giai đoạn bình chọn không hợp lệ." };
  }
  const opensAt = mode === "upcoming" ? parseOptionalIso(body.opensAt) : null;
  const votingEndsAt = parseOptionalIso(body.votingEndsAt);
  if (opensAt === "invalid") return { ok: false, error: "Giờ mở bình chọn không hợp lệ." };
  if (votingEndsAt === "invalid") return { ok: false, error: "Giờ dừng nhận phiếu không hợp lệ." };
  if (opensAt && votingEndsAt && new Date(votingEndsAt) <= new Date(opensAt)) {
    return { ok: false, error: "Giờ dừng nhận phiếu phải sau giờ mở bình chọn." };
  }
  return { ok: true, value: { mode, opensAt, votingEndsAt } };
}
