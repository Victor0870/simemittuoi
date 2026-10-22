const MAX_SCHEDULE_DAYS = 366;

export function isScheduledAt(isoDate: string, now = Date.now()): boolean {
  return new Date(isoDate).getTime() > now;
}

export function formatScheduleLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export type ParsedSchedule = { ok: true; iso: string } | { ok: false; error: string };

export function parseScheduledAt(value: unknown): ParsedSchedule {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, error: "Thời điểm hẹn giờ không hợp lệ." };
  }
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return { ok: false, error: "Thời điểm hẹn giờ không hợp lệ." };
  }
  const now = Date.now();
  if (time <= now) {
    return { ok: false, error: "Thời điểm hẹn giờ phải ở tương lai." };
  }
  if (time > now + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, error: "Chỉ hẹn giờ đăng tối đa 1 năm tới." };
  }
  return { ok: true, iso: new Date(time).toISOString() };
}

/** ISO -> giá trị cho input datetime-local theo giờ máy người dùng. */
export function toDateTimeLocalValue(isoDate: string | Date): string {
  const d = new Date(isoDate);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
