"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CategoryBadge, StatusBadge } from "@/components/life-events/LifeEventBadges";
import { acceptedFile, uploadAttachment } from "@/components/life-events/LifeEventForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateTimeVi } from "@/lib/data/albums";
import {
  LIFE_EVENT_LIMITS,
  LOG_ACTION_LABEL,
  TYPE_BY_CODE,
  describeSubject,
} from "@/lib/life-events/registry";
import type { LifeEventDetail } from "@/lib/life-events/server";
import { formatDateVi } from "@/lib/members/profile-shared";

type Props = {
  detail: LifeEventDetail;
  userId: string;
  isOwner: boolean;
  isOffice: boolean;
  canHandle: boolean;
};

const textareaClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function LifeEventDetailView({ detail, userId, isOwner, isOffice, canHandle }: Props) {
  const router = useRouter();
  const type = TYPE_BY_CODE[detail.event_type];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState("");
  const [note, setNote] = useState("");

  const isSubmitted = detail.status === "submitted";
  const canAddFiles =
    detail.status !== "withdrawn" &&
    (isOwner || canHandle) &&
    detail.attachments.length < LIFE_EVENT_LIMITS.maxAttachments;

  async function call(label: string, url: string, init: RequestInit): Promise<boolean> {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Thao tác không thành công.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Mất kết nối, vui lòng thử lại.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const transition = (to: "acknowledged" | "withdrawn", noteText?: string) =>
    call(to, `/api/life-events/${detail.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, note: noteText }),
    });

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const room = LIFE_EVENT_LIMITS.maxAttachments - detail.attachments.length;
    const picked = [...list].filter(acceptedFile).slice(0, room);
    if (!picked.length) return;
    setBusy("upload");
    setError(null);
    const failed: string[] = [];
    for (const file of picked) {
      const err = await uploadAttachment(detail.id, file);
      if (err) failed.push(err);
    }
    setBusy(null);
    if (failed.length) setError(failed.join(" "));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={detail.category} />
          <StatusBadge status={detail.status} />
          <span className="ml-auto text-xs font-semibold text-on-surface-variant">{detail.code}</span>
        </div>
        <h1 className="mt-2 text-headline-sm font-extrabold text-[#173A67]">{type?.label ?? detail.event_type}</h1>

        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {isOffice ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-on-surface-variant">Đoàn viên báo tin</dt>
              <dd className="font-semibold">
                {detail.member?.full_name ?? "—"}
                <span className="font-normal text-on-surface-variant">
                  {detail.member?.employee_code ? ` · ${detail.member.employee_code}` : ""}
                  {detail.member?.department ? ` · ${detail.member.department}` : ""}
                </span>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-on-surface-variant">Người liên quan</dt>
            <dd className="font-semibold">{describeSubject(detail.subject_relation, detail.subject_name)}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">{type?.dateLabel ?? "Ngày"}</dt>
            <dd className="font-semibold">{formatDateVi(detail.event_date)}</dd>
          </div>
          {detail.location ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-on-surface-variant">{type?.locationLabel ?? "Địa điểm"}</dt>
              <dd>{detail.location}</dd>
            </div>
          ) : null}
          {detail.description ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-on-surface-variant">Lời nhắn</dt>
              <dd className="whitespace-pre-line">{detail.description}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-on-surface-variant">Gửi lúc</dt>
            <dd>{formatDateTimeVi(detail.created_at)}</dd>
          </div>
        </dl>

        {detail.status === "acknowledged" ? (
          <div className="mt-4 rounded-xl border border-[#173A67]/15 bg-[#D9F2EC]/60 px-4 py-3 text-sm text-[#173A67]">
            <p className="font-bold">
              <MaterialIcon className="mr-1 align-[-4px] text-[18px]" name="task_alt" />
              Đã tiếp nhận{detail.handler_name ? ` bởi ${detail.handler_name}` : ""}
              {detail.handled_at ? ` lúc ${formatDateTimeVi(detail.handled_at)}` : ""}
            </p>
            {detail.handler_note ? <p className="mt-1 whitespace-pre-line">{detail.handler_note}</p> : null}
          </div>
        ) : null}
      </div>

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-title-md font-bold text-[#173A67]">Ảnh đính kèm ({detail.attachments.length})</h2>
          {canAddFiles ? (
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-[#173A67] hover:border-[#173A67]">
              <MaterialIcon className="text-[18px]" name={busy === "upload" ? "progress_activity" : "add_a_photo"} />
              {busy === "upload" ? "Đang tải..." : "Thêm ảnh"}
              <input
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                disabled={busy !== null}
                type="file"
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
        {detail.attachments.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            Chưa có ảnh đính kèm.{type ? ` Gợi ý: ${type.attachmentHint.toLowerCase()}.` : ""}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {detail.attachments.map((a) => {
              const canDelete = canHandle || (a.uploaded_by === userId && isSubmitted);
              return (
                <div key={a.id} className="overflow-hidden rounded-xl border border-outline-variant bg-white">
                  <a
                    className="flex aspect-[4/3] items-center justify-center bg-surface-container-low"
                    href={a.url ?? "#"}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {a.url && a.mime_type.startsWith("image/") ? (
                      <img alt={a.file_name} className="h-full w-full object-cover" src={a.url} />
                    ) : (
                      <MaterialIcon className="text-[40px] text-red-600" name="picture_as_pdf" />
                    )}
                  </a>
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <p className="min-w-0 flex-1 truncate text-[11px] text-on-surface-variant" title={a.file_name}>
                      {a.file_name} · {formatSize(a.size_bytes)}
                    </p>
                    {canDelete ? (
                      <button
                        aria-label="Xóa tệp"
                        className="rounded-full p-1 text-on-surface-variant hover:bg-error-container hover:text-error"
                        disabled={busy !== null}
                        type="button"
                        onClick={() => {
                          if (confirm(`Xóa tệp "${a.file_name}"?`)) {
                            void call("delete", `/api/life-events/${detail.id}/attachments?attachmentId=${a.id}`, {
                              method: "DELETE",
                            });
                          }
                        }}
                      >
                        <MaterialIcon className="text-[16px]" name="delete" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {detail.attachments.length ? (
          <p className="mt-2 text-[11px] text-on-surface-variant">Liên kết xem ảnh hết hạn sau 10 phút, tải lại trang để mở lại.</p>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      {canHandle && isSubmitted ? (
        <section className="space-y-2 rounded-2xl border-2 border-[#173A67]/20 bg-white p-4 sm:p-5">
          <h2 className="text-title-md font-bold text-[#173A67]">Tiếp nhận tin báo</h2>
          <textarea
            className={`${textareaClass} min-h-[70px]`}
            maxLength={LIFE_EVENT_LIMITS.note}
            placeholder="Lời nhắn gửi đoàn viên (không bắt buộc), ví dụ: Công đoàn sẽ đến thăm vào thứ Bảy."
            value={ackNote}
            onChange={(e) => setAckNote(e.target.value)}
          />
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-60"
            disabled={busy !== null}
            type="button"
            onClick={() => void transition("acknowledged", ackNote)}
          >
            <MaterialIcon className="text-[18px]" name={busy === "acknowledged" ? "progress_activity" : "task_alt"} />
            Tiếp nhận
          </button>
          <p className="text-[11px] text-on-surface-variant">Đoàn viên sẽ nhận được thông báo kèm lời nhắn này.</p>
        </section>
      ) : null}

      {canHandle ? (
        <section className="space-y-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <h2 className="text-title-sm font-bold text-[#173A67]">Ghi chú nội bộ</h2>
          <p className="text-[11px] text-on-surface-variant">Chỉ Ban chấp hành thấy, đoàn viên không thấy.</p>
          <textarea
            className={`${textareaClass} min-h-[60px]`}
            maxLength={LIFE_EVENT_LIMITS.note}
            placeholder="Ví dụ: Đã gọi điện hỏi thăm, hẹn thăm ngày…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-[#173A67] hover:border-[#173A67] disabled:opacity-60"
            disabled={busy !== null || !note.trim()}
            type="button"
            onClick={async () => {
              const ok = await call("note", `/api/life-events/${detail.id}/note`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note }),
              });
              if (ok) setNote("");
            }}
          >
            <MaterialIcon className="text-[18px]" name="edit_note" />
            Lưu ghi chú
          </button>
        </section>
      ) : null}

      {isOwner && isSubmitted ? (
        <div className="flex justify-end">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-error hover:text-error disabled:opacity-60"
            disabled={busy !== null}
            type="button"
            onClick={() => {
              if (confirm("Rút lại tin báo này? Ban chấp hành sẽ không xử lý tin đã rút.")) void transition("withdrawn");
            }}
          >
            <MaterialIcon className="text-[18px]" name="undo" />
            Rút lại tin báo
          </button>
        </div>
      ) : null}

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <h2 className="mb-3 text-title-sm font-bold text-[#173A67]">Lịch sử</h2>
        <ol className="space-y-3 border-l-2 border-outline-variant pl-4">
          {detail.logs.map((l) => (
            <li key={l.id} className="relative">
              <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-[#173A67]" />
              <p className="text-sm">
                <b>{LOG_ACTION_LABEL[l.action] ?? l.action}</b>
                {l.actor_name ? <span className="text-on-surface-variant"> · {l.actor_name}</span> : null}
              </p>
              {l.note ? <p className="text-sm whitespace-pre-line text-on-surface-variant">{l.note}</p> : null}
              <p className="text-[11px] text-on-surface-variant">{formatDateTimeVi(l.created_at)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
