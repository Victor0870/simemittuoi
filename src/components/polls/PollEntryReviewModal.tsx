"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { ENTRY_STATUS_LABEL, type EntryApprovalStatus } from "@/lib/polls/vote-mode";

type Entry = {
  id: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  status: EntryApprovalStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  members: { fullName: string; employeeCode: string | null }[];
};

type Props = {
  pollId: string;
  isOpen: boolean;
  onClose: () => void;
};

const FILTERS: Array<{ value: EntryApprovalStatus | "all"; label: string }> = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Bị từ chối" },
  { value: "withdrawn", label: "Đã rút" },
  { value: "all", label: "Tất cả" },
];

export function PollEntryReviewModal({ pollId, isOpen, onClose }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState<EntryApprovalStatus | "all">("pending");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/polls/entries/review?pollId=${encodeURIComponent(pollId)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không tải được danh sách bài nộp.");
      setEntries(data.entries ?? []);
    } catch (err: any) {
      setError(err?.message || "Không tải được danh sách bài nộp.");
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  async function review(optionId: string, action: "approve" | "reject", reason?: string) {
    setBusyId(optionId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/polls/entries/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId, action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Thao tác thất bại.");
      setMessage(data.message || "Đã cập nhật.");
      setRejecting(null);
      await load();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Thao tác thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = filter === "all" ? entries : entries.filter((e) => e.status === filter);
  const pendingCount = entries.filter((e) => e.status === "pending").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3">
          <div>
            <h3 className="text-base font-extrabold text-[#173A67]">Duyệt bài dự thi</h3>
            <p className="text-xs text-on-surface-variant">
              Chỉ bài đã duyệt hiện trong danh sách bình chọn và tính người dự thi. Đang chờ duyệt: {pendingCount} bài.
            </p>
          </div>
          <button
            aria-label="Đóng"
            className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container cursor-pointer"
            type="button"
            onClick={onClose}
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-outline-variant px-5 py-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer ${
                filter === f.value ? "bg-[#173A67] text-white" : "bg-surface-container-low text-on-surface-variant"
              }`}
              type="button"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}
          {loading && entries.length === 0 ? (
            <p className="text-xs text-on-surface-variant">Đang tải...</p>
          ) : visible.length === 0 ? (
            <p className="text-xs text-on-surface-variant">Không có bài nào.</p>
          ) : (
            visible.map((entry) => (
              <div key={entry.id} className="space-y-2 rounded-xl border border-outline-variant p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-[#173A67]">{entry.title}</p>
                    <p className="text-xs text-on-surface-variant">
                      {ENTRY_STATUS_LABEL[entry.status]}
                      {entry.submittedByName ? ` · Người nộp: ${entry.submittedByName}` : ""}
                      {entry.submittedAt ? ` · ${new Date(entry.submittedAt).toLocaleString("vi-VN")}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {entry.status === "pending" || entry.status === "rejected" ? (
                      <button
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                        disabled={busyId === entry.id}
                        type="button"
                        onClick={() => review(entry.id, "approve")}
                      >
                        Duyệt
                      </button>
                    ) : null}
                    {entry.status === "pending" ? (
                      <button
                        className="rounded-lg border border-rose-400 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                        disabled={busyId === entry.id}
                        type="button"
                        onClick={() => setRejecting({ id: entry.id, reason: "" })}
                      >
                        Từ chối
                      </button>
                    ) : null}
                  </div>
                </div>
                {entry.description ? <p className="text-xs text-on-surface whitespace-pre-line">{entry.description}</p> : null}
                {entry.imageUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {entry.imageUrls.map((url, i) => (
                      <a key={i} href={url} rel="noreferrer" target="_blank">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" className="h-20 w-24 rounded-lg border border-outline-variant object-cover" src={url} />
                      </a>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs text-on-surface-variant">
                  Thành viên:{" "}
                  {entry.members.map((m) => `${m.fullName}${m.employeeCode ? ` (${m.employeeCode})` : ""}`).join(", ") || "—"}
                </p>
                {entry.status === "rejected" && entry.reviewNote ? (
                  <p className="text-xs font-semibold text-rose-700">Lý do từ chối: {entry.reviewNote}</p>
                ) : null}
                {rejecting?.id === entry.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="min-w-[200px] flex-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm"
                      maxLength={500}
                      placeholder="Lý do từ chối"
                      type="text"
                      value={rejecting.reason}
                      onChange={(e) => setRejecting({ id: entry.id, reason: e.target.value })}
                    />
                    <button
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                      disabled={busyId === entry.id || !rejecting.reason.trim()}
                      type="button"
                      onClick={() => review(entry.id, "reject", rejecting.reason.trim())}
                    >
                      Xác nhận từ chối
                    </button>
                    <button
                      className="text-xs font-semibold text-on-surface-variant cursor-pointer"
                      type="button"
                      onClick={() => setRejecting(null)}
                    >
                      Hủy
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
