"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PopupEditorModal } from "@/components/admin/PopupEditorModal";
import { PopupCard } from "@/components/popups/PopupCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  POPUP_AUDIENCE_LABEL,
  POPUP_FREQUENCY_LABEL,
  POPUP_STATUS_META,
  POPUP_TONE_META,
  formatPopupTime,
  getPopupStatus,
  type AdminPopup,
  type PopupStatus,
} from "@/lib/popups";

type Props = {
  popups: AdminPopup[];
  memberCount: number;
};

const STATUS_ORDER: PopupStatus[] = ["showing", "scheduled", "off", "expired"];

export function AdminPopupsManager({ popups, memberCount }: Props) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPopup | null>(null);
  const [previewing, setPreviewing] = useState<AdminPopup | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      popups
        .map((p) => ({ popup: p, status: getPopupStatus(p) }))
        .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)),
    [popups],
  );
  const counts = useMemo(() => {
    const c: Record<PopupStatus, number> = { showing: 0, scheduled: 0, expired: 0, off: 0 };
    for (const { status } of sorted) c[status] += 1;
    return c;
  }, [sorted]);

  function openEditor(popup: AdminPopup | null) {
    setEditing(popup);
    setEditorOpen(true);
  }

  async function mutate(popup: AdminPopup, init: RequestInit) {
    setBusyId(popup.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/popups/${popup.id}`, {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Thao tác không thành công.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác không thành công.");
    } finally {
      setBusyId(null);
    }
  }

  function toggle(popup: AdminPopup) {
    void mutate(popup, { method: "PATCH", body: JSON.stringify({ isActive: !popup.isActive }) });
  }

  function remove(popup: AdminPopup) {
    if (!window.confirm(`Xóa popup "${popup.title}"? Thống kê lượt xem cũng bị xóa.`)) return;
    void mutate(popup, { method: "DELETE" });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <span
              key={s}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${POPUP_STATUS_META[s].chip}`}
            >
              {POPUP_STATUS_META[s].label}: {counts[s]}
            </span>
          ))}
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-dusty-dark"
          type="button"
          onClick={() => openEditor(null)}
        >
          <MaterialIcon className="text-[20px]" name="add_alert" />
          Đăng popup mới
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900" role="alert">
          {error}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-dusty-border bg-white p-10 text-center">
          <MaterialIcon className="text-[40px] text-on-surface-variant" name="notification_important" />
          <p className="mt-2 font-bold text-on-surface">Chưa có popup nào</p>
          <p className="text-sm text-on-surface-variant">
            Bấm &quot;Đăng popup mới&quot; để gửi tin gấp hiện nổi trên màn hình đoàn viên.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map(({ popup, status }) => {
            const tone = POPUP_TONE_META[popup.tone];
            const busy = busyId === popup.id;
            return (
              <li
                key={popup.id}
                className={`rounded-2xl border border-dusty-border/80 bg-white p-4 shadow-xs sm:p-5 ${
                  status === "expired" || status === "off" ? "opacity-75" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${POPUP_STATUS_META[status].chip}`}
                  >
                    {status === "showing" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> : null}
                    {POPUP_STATUS_META[status].label}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tone.chip}`}>
                    <MaterialIcon className="text-[14px]" name={tone.icon} />
                    {tone.label}
                  </span>
                  {popup.audience === "all" ? (
                    <span className="rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-800">
                      Công khai
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-2 break-words text-base font-extrabold text-on-surface">{popup.title}</h3>
                <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-sm text-on-surface-variant">
                  {popup.body}
                </p>

                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-2">
                  <div className="flex gap-1">
                    <dt className="font-semibold">Thời gian:</dt>
                    <dd>
                      {formatPopupTime(popup.startsAt)} → {popup.endsAt ? formatPopupTime(popup.endsAt) : "không tự tắt"}
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="font-semibold">Hiện:</dt>
                    <dd>
                      {POPUP_FREQUENCY_LABEL[popup.frequency]} · {POPUP_AUDIENCE_LABEL[popup.audience]}
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="font-semibold">Đã xem:</dt>
                    <dd>
                      <strong className="text-on-surface">{popup.viewerCount}</strong>/{memberCount} đoàn viên
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="font-semibold">Người đăng:</dt>
                    <dd>{popup.createdByName || "—"}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-dusty-border/60 pt-3">
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-dusty-border px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:border-primary hover:text-primary"
                    type="button"
                    onClick={() => setPreviewing(popup)}
                  >
                    <MaterialIcon className="text-[16px]" name="visibility" />
                    Xem thử
                  </button>
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-dusty-border px-3 py-1.5 text-xs font-bold text-primary hover:border-primary"
                    disabled={busy}
                    type="button"
                    onClick={() => openEditor(popup)}
                  >
                    <MaterialIcon className="text-[16px]" name="edit" />
                    Sửa
                  </button>
                  <button
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                      popup.isActive
                        ? "border-amber-300 text-amber-800 hover:bg-amber-50"
                        : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    }`}
                    disabled={busy}
                    type="button"
                    onClick={() => toggle(popup)}
                  >
                    <MaterialIcon className="text-[16px]" name={popup.isActive ? "pause_circle" : "play_circle"} />
                    {popup.isActive ? "Tắt" : "Bật"}
                  </button>
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    disabled={busy}
                    type="button"
                    onClick={() => remove(popup)}
                  >
                    <MaterialIcon className="text-[16px]" name="delete" />
                    Xóa
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PopupEditorModal
        isOpen={editorOpen}
        popup={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => router.refresh()}
      />

      {previewing ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewing(null);
          }}
        >
          <PopupCard
            popup={previewing}
            onClose={() => setPreviewing(null)}
            onOpenLink={() => setPreviewing(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
