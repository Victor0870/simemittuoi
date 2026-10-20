"use client";

import { useEffect, useState } from "react";
import { PopupCard } from "@/components/popups/PopupCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  POPUP_AUDIENCE_LABEL,
  POPUP_BODY_MAX,
  POPUP_FREQUENCY_LABEL,
  POPUP_LINK_LABEL_MAX,
  POPUP_TITLE_MAX,
  POPUP_TONE_META,
  type AdminPopup,
  type PopupAudience,
  type PopupFrequency,
  type PopupTone,
} from "@/lib/popups";

type Props = {
  isOpen: boolean;
  popup: AdminPopup | null;
  onClose: () => void;
  onSaved: () => void;
};

const inputClass =
  "w-full rounded-xl border border-dusty-border px-3.5 py-2.5 text-base text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm";

const TONE_ORDER: PopupTone[] = ["urgent", "info", "warning", "success"];
const FREQUENCY_HINT: Record<PopupFrequency, string> = {
  once: "Đóng rồi thì không hiện lại (kể cả đăng nhập máy khác)",
  daily: "Hiện lại vào ngày hôm sau cho tới khi hết hạn",
  session: "Hiện lại mỗi lần mở lại trình duyệt",
};
const DURATIONS = [
  { label: "1 ngày", hours: 24 },
  { label: "3 ngày", hours: 72 },
  { label: "7 ngày", hours: 168 },
];

/** ISO → giá trị ô datetime-local theo giờ máy người dùng. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function addHours(fromLocal: string, hours: number): string {
  const base = fromLocal ? new Date(fromLocal) : new Date();
  return toLocalInput(new Date(base.getTime() + hours * 3600_000).toISOString());
}

export function PopupEditorModal({ isOpen, popup, onClose, onSaved }: Props) {
  const [tone, setTone] = useState<PopupTone>("urgent");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [audience, setAudience] = useState<PopupAudience>("members");
  const [frequency, setFrequency] = useState<PopupFrequency>("once");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [useDailyWindow, setUseDailyWindow] = useState(false);
  const [dailyStart, setDailyStart] = useState("07:00");
  const [dailyEnd, setDailyEnd] = useState("09:00");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTone(popup?.tone ?? "urgent");
    setTitle(popup?.title ?? "");
    setBody(popup?.body ?? "");
    setLinkUrl(popup?.linkUrl ?? "");
    setLinkLabel(popup?.linkLabel ?? "");
    setAudience(popup?.audience ?? "members");
    setFrequency(popup?.frequency ?? "once");
    setStartsAt(toLocalInput(popup?.startsAt ?? null));
    setEndsAt(popup ? toLocalInput(popup.endsAt) : addHours("", 72));
    setUseDailyWindow(Boolean(popup?.dailyStart));
    setDailyStart(popup?.dailyStart ?? "07:00");
    setDailyEnd(popup?.dailyEnd ?? "09:00");
    setIsActive(popup?.isActive ?? true);
    setErrorMessage(null);
  }, [isOpen, popup]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim() || !body.trim()) {
      setErrorMessage("Vui lòng nhập tiêu đề và nội dung.");
      return;
    }
    const effectiveStart = startsAt || toLocalInput(new Date().toISOString());
    if (endsAt && endsAt <= effectiveStart) {
      setErrorMessage("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }
    if (useDailyWindow && (!dailyStart || !dailyEnd || dailyEnd <= dailyStart)) {
      setErrorMessage("Khung giờ mỗi ngày: giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(popup ? `/api/admin/popups/${popup.id}` : "/api/admin/popups", {
        method: popup ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          tone,
          linkUrl,
          linkLabel,
          audience,
          frequency,
          startsAt: fromLocalInput(startsAt),
          endsAt: fromLocalInput(endsAt),
          dailyStart: useDailyWindow ? dailyStart : null,
          dailyEnd: useDailyWindow ? dailyEnd : null,
          isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không thể lưu popup.");
      onSaved();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Đã xảy ra lỗi khi lưu popup.");
    } finally {
      setSubmitting(false);
    }
  }

  const choiceClass = (selected: boolean) =>
    `rounded-2xl border-2 p-3 text-left transition ${
      selected ? "border-primary bg-primary/5" : "border-dusty-border hover:border-primary/40"
    }`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-2 backdrop-blur-xs sm:p-5">
      <div className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-dusty-border bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-dusty-border/70 bg-gradient-to-r from-dusty-light/60 to-white px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <MaterialIcon className="text-[22px]" name="notification_important" />
            </div>
            <div>
              <h2 className="text-title-md font-bold text-on-surface sm:text-title-lg">
                {popup ? "Sửa popup" : "Đăng popup mới"}
              </h2>
              <p className="text-xs text-on-surface-variant">Tin ngắn hiện nổi trên màn hình đoàn viên</p>
            </div>
          </div>
          <button
            aria-label="Đóng"
            className="rounded-full p-1.5 text-on-surface-variant transition hover:bg-surface-container-high"
            type="button"
            onClick={onClose}
          >
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="grid min-h-0 flex-1 overflow-y-auto overscroll-contain md:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4 p-5 sm:p-6">
              {errorMessage ? (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900" role="alert">
                  {errorMessage}
                </div>
              ) : null}

              <div>
                <p className="mb-1.5 text-xs font-bold text-on-surface sm:text-sm">Loại tin</p>
                <div className="flex flex-wrap gap-2">
                  {TONE_ORDER.map((t) => {
                    const meta = POPUP_TONE_META[t];
                    return (
                      <button
                        key={t}
                        className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold transition ${
                          tone === t
                            ? `${meta.chip} ring-2 ring-primary/30 ring-offset-1`
                            : "border-dusty-border text-on-surface-variant"
                        }`}
                        type="button"
                        onClick={() => setTone(t)}
                      >
                        <MaterialIcon className="text-[18px]" name={meta.icon} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border-2 border-primary/20 bg-dusty-light/30 p-4">
                <div className="flex items-center gap-1.5">
                  <MaterialIcon className="text-[20px] text-primary" name="schedule" />
                  <p className="text-sm font-bold text-on-surface">Thời gian xuất hiện</p>
                </div>
                <p className="-mt-1 text-[11px] text-on-surface-variant">
                  Popup tự hiện khi tới giờ bắt đầu và tự tắt khi hết giờ kết thúc — không cần bật / tắt tay.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-on-surface-variant">
                      Bắt đầu hiện (để trống = ngay khi lưu)
                    </span>
                    <input
                      className={inputClass}
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-on-surface-variant">
                      Tự tắt lúc (để trống = không tự tắt)
                    </span>
                    <input
                      className={inputClass}
                      min={startsAt || undefined}
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-on-surface-variant">Hiện trong:</span>
                  {DURATIONS.map((d) => (
                    <button
                      key={d.hours}
                      className="rounded-full border border-dusty-border bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:border-primary"
                      type="button"
                      onClick={() => setEndsAt(addHours(startsAt, d.hours))}
                    >
                      {d.label}
                    </button>
                  ))}
                  <button
                    className="rounded-full border border-dusty-border bg-white px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:border-primary"
                    type="button"
                    onClick={() => setEndsAt("")}
                  >
                    Không tự tắt
                  </button>
                </div>

                <div className="border-t border-dusty-border/60 pt-3">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      checked={useDailyWindow}
                      className="h-4 w-4 accent-[#173A67]"
                      type="checkbox"
                      onChange={(e) => setUseDailyWindow(e.target.checked)}
                    />
                    <span className="text-xs font-bold text-on-surface sm:text-sm">
                      Chỉ hiện trong khung giờ mỗi ngày
                    </span>
                  </label>
                  {useDailyWindow ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          aria-label="Giờ bắt đầu mỗi ngày"
                          className={inputClass}
                          type="time"
                          value={dailyStart}
                          onChange={(e) => setDailyStart(e.target.value)}
                        />
                        <span className="text-sm text-on-surface-variant">đến</span>
                        <input
                          aria-label="Giờ kết thúc mỗi ngày"
                          className={inputClass}
                          type="time"
                          value={dailyEnd}
                          onChange={(e) => setDailyEnd(e.target.value)}
                        />
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Giờ Việt Nam. VD 07:00 đến 09:00: mỗi ngày popup tự hiện lúc 7h và tự ẩn lúc 9h, lặp lại
                        cho tới ngày tự tắt ở trên. Nên chọn &quot;Mỗi ngày 1 lần&quot; ở mục tần suất.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 flex justify-between text-xs font-bold text-on-surface sm:text-sm">
                  <span>
                    Tiêu đề <span className="text-red-500">*</span>
                  </span>
                  <span className="font-normal text-on-surface-variant">
                    {title.length}/{POPUP_TITLE_MAX}
                  </span>
                </span>
                <input
                  className={inputClass}
                  maxLength={POPUP_TITLE_MAX}
                  placeholder="VD: Thay đổi lịch đón đoàn viên đi tham quan"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 flex justify-between text-xs font-bold text-on-surface sm:text-sm">
                  <span>
                    Nội dung <span className="text-red-500">*</span>
                  </span>
                  <span className="font-normal text-on-surface-variant">
                    {body.length}/{POPUP_BODY_MAX}
                  </span>
                </span>
                <textarea
                  className={inputClass}
                  maxLength={POPUP_BODY_MAX}
                  placeholder="Nội dung ngắn gọn, xuống dòng bằng Enter."
                  required
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-on-surface sm:text-sm">
                    Nút liên kết (không bắt buộc)
                  </span>
                  <input
                    className={inputClass}
                    placeholder="/posts/... hoặc https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-on-surface sm:text-sm">Chữ trên nút</span>
                  <input
                    className={inputClass}
                    disabled={!linkUrl.trim()}
                    maxLength={POPUP_LINK_LABEL_MAX}
                    placeholder="Xem chi tiết"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold text-on-surface sm:text-sm">Ai thấy popup?</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(["members", "all"] as const).map((a) => (
                    <button key={a} className={choiceClass(audience === a)} type="button" onClick={() => setAudience(a)}>
                      <span className="block text-sm font-bold text-on-surface">{POPUP_AUDIENCE_LABEL[a]}</span>
                      <span className="block text-[11px] text-on-surface-variant">
                        {a === "members" ? "Nội dung nội bộ, khách không thấy" : "Thông báo công khai, khách vào web cũng thấy"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold text-on-surface sm:text-sm">Hiện bao nhiêu lần?</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(["once", "daily", "session"] as const).map((f) => (
                    <button key={f} className={choiceClass(frequency === f)} type="button" onClick={() => setFrequency(f)}>
                      <span className="block text-sm font-bold text-on-surface">{POPUP_FREQUENCY_LABEL[f]}</span>
                      <span className="block text-[11px] text-on-surface-variant">{FREQUENCY_HINT[f]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-dusty-border/80 p-3">
                <input
                  checked={isActive}
                  className="h-4 w-4 accent-[#173A67]"
                  type="checkbox"
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-bold text-on-surface">Bật popup</span>
                  <span className="block text-[11px] text-on-surface-variant">
                    Bỏ chọn để lưu nháp / tạm tắt (đoàn viên không thấy)
                  </span>
                </span>
              </label>
            </div>

            <div className="border-t border-dusty-border/70 bg-slate-100 p-5 md:border-l md:border-t-0">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Xem trước</p>
              <div className="flex justify-center">
                <PopupCard
                  popup={{
                    title: title.trim(),
                    body: body.trim(),
                    tone,
                    linkUrl: linkUrl.trim() || null,
                    linkLabel: linkLabel.trim() || null,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-dusty-border/70 bg-white px-5 py-3 sm:px-6">
            <button
              className="rounded-xl border border-dusty-border px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-dusty-light/50"
              disabled={submitting}
              type="button"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              <MaterialIcon className="text-[18px]" name={submitting ? "hourglass_top" : "send"} />
              <span>{submitting ? "Đang lưu..." : popup ? "Lưu thay đổi" : isActive ? "Đăng popup" : "Lưu nháp"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
