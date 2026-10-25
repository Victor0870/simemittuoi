"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmployeeSuggestInput } from "@/components/polls/EmployeeSuggestInput";
import { usePollPhase } from "@/components/polls/usePollPhase";
import type { PollDetail } from "@/lib/data/polls";
import { resizeImageFile } from "@/lib/image-resize";
import { formatPollTime } from "@/lib/polls/phase";
import { ENTRY_STATUS_LABEL, type EntryApprovalStatus } from "@/lib/polls/vote-mode";

type Props = {
  poll: PollDetail;
  initialNow: number;
};

type Entry = {
  id: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  status: EntryApprovalStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  members: { fullName: string; employeeCode: string | null }[];
};

type MemberRow = { fullName: string; employeeCode: string };

type FormState = {
  id?: string;
  title: string;
  description: string;
  imageUrls: string[];
  members: MemberRow[];
};

const STATUS_CLASS: Record<EntryApprovalStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-300",
  rejected: "bg-rose-100 text-rose-900 border-rose-300",
  withdrawn: "bg-slate-100 text-slate-600 border-slate-300",
};

const MEMBER_SEARCH_URL = "/api/polls/entries/member-search";

export function PollEntrySubmissionSection({ poll, initialNow }: Props) {
  const router = useRouter();
  const phase = usePollPhase(poll, initialNow);
  const { user, loading: authLoading } = useAuth();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [self, setSelf] = useState<MemberRow | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now] = useState(initialNow);

  const deadlinePassed = Boolean(poll.submissionDeadline && new Date(poll.submissionDeadline).getTime() <= now);
  const isClosed = phase === "closed" || phase === "ended";
  const windowOpen = !isClosed && !deadlinePassed && poll.isActive !== false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/polls/entries?pollId=${encodeURIComponent(poll.id)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không tải được bài dự thi.");
      setEntries(data.entries ?? []);
      if (data.submitter?.employeeCode) {
        setSelf({ fullName: data.submitter.fullName || "", employeeCode: data.submitter.employeeCode });
      }
    } catch (err: any) {
      setError(err?.message || "Không tải được bài dự thi.");
    } finally {
      setLoading(false);
    }
  }, [poll.id]);

  useEffect(() => {
    if (!authLoading && user) void load();
  }, [authLoading, user, load]);

  function startNew() {
    setError(null);
    setMessage(null);
    setForm({
      title: "",
      description: "",
      imageUrls: [],
      members: self ? [{ ...self }, { fullName: "", employeeCode: "" }] : [{ fullName: "", employeeCode: "" }],
    });
  }

  function startEdit(entry: Entry) {
    setError(null);
    setMessage(null);
    setForm({
      id: entry.id,
      title: entry.title,
      description: entry.description ?? "",
      imageUrls: [...entry.imageUrls],
      members: [
        ...entry.members.map((m) => ({ fullName: m.fullName, employeeCode: m.employeeCode ?? "" })),
        { fullName: "", employeeCode: "" },
      ],
    });
  }

  function updateMember(index: number, patch: Partial<MemberRow>) {
    setForm((prev) => {
      if (!prev) return prev;
      const members = prev.members.map((m, i) => (i === index ? { ...m, ...patch } : m));
      if (index === members.length - 1 && (members[index].employeeCode || members[index].fullName)) {
        members.push({ fullName: "", employeeCode: "" });
      }
      return { ...prev, members };
    });
  }

  async function handleImages(files: FileList | null) {
    if (!files || !form) return;
    const next = [...form.imageUrls];
    for (const file of Array.from(files)) {
      if (next.length >= 3) break;
      try {
        next.push(await resizeImageFile(file, 1200, 900, 0.78));
      } catch {
        setError("Không đọc được ảnh, vui lòng chọn ảnh khác.");
      }
    }
    setForm((prev) => (prev ? { ...prev, imageUrls: next } : prev));
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setMessage(null);
    const members = form.members.filter((m) => m.employeeCode.trim());
    if (!form.title.trim()) {
      setError("Vui lòng nhập tên bài thi.");
      return;
    }
    if (members.length === 0) {
      setError("Vui lòng chọn ít nhất 1 thành viên.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/polls/entries", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId: poll.id,
          optionId: form.id,
          title: form.title,
          description: form.description,
          imageUrls: form.imageUrls,
          members,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không lưu được bài.");
      setMessage(data.message || "Đã lưu bài.");
      setForm(null);
      await load();
    } catch (err: any) {
      setError(err?.message || "Không lưu được bài.");
    } finally {
      setSaving(false);
    }
  }

  async function withdraw(entry: Entry) {
    if (!window.confirm(`Rút bài "${entry.title}"? Bài sẽ không được xét duyệt nữa.`)) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/polls/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: entry.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không rút được bài.");
      setMessage(data.message || "Đã rút bài.");
      await load();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Không rút được bài.");
    }
  }

  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-[#173A67]">Nộp bài dự thi</h3>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            {isClosed
              ? "Chương trình đã kết thúc, không nhận bài nữa."
              : deadlinePassed
              ? `Đã hết hạn nộp bài (${formatPollTime(poll.submissionDeadline!)}).`
              : poll.submissionDeadline
              ? `Hạn nộp bài: ${formatPollTime(poll.submissionDeadline)}. Bài hiện trong danh sách bình chọn sau khi được duyệt.`
              : "Bài hiện trong danh sách bình chọn sau khi Ban tổ chức duyệt."}
          </p>
        </div>
        {user && windowOpen && !form ? (
          <button
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-dusty-dark transition cursor-pointer"
            type="button"
            onClick={startNew}
          >
            <MaterialIcon className="text-[18px]" name="upload" />
            <span>Nộp bài mới</span>
          </button>
        ) : null}
      </div>

      {!authLoading && !user ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 p-3 text-sm text-[#173A67]">
          <span>Đăng nhập tài khoản đoàn viên để nộp bài và theo dõi trạng thái duyệt.</span>
          <Link
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white"
            href={`/login?returnUrl=/polls/${poll.id}`}
          >
            Đăng nhập
          </Link>
        </div>
      ) : null}

      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-xl bg-error-container/40 p-3 text-sm font-semibold text-on-error-container">{error}</p> : null}

      {form ? (
        <form className="space-y-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4" onSubmit={submitForm}>
          <h4 className="text-sm font-extrabold text-[#173A67]">{form.id ? "Sửa bài đang chờ duyệt" : "Bài dự thi mới"}</h4>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-[#173A67]">Tên bài thi</span>
            <input
              className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm"
              maxLength={200}
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-[#173A67]">Mô tả</span>
            <textarea
              className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm"
              maxLength={3000}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <div className="space-y-1">
            <span className="text-xs font-bold text-[#173A67]">Hình ảnh ({form.imageUrls.length}/3)</span>
            <div className="flex flex-wrap gap-2">
              {form.imageUrls.map((url, i) => (
                <div key={i} className="relative h-20 w-24 overflow-hidden rounded-xl border border-outline-variant bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="h-full w-full object-cover" src={url} />
                  <button
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white cursor-pointer"
                    title="Xóa ảnh"
                    type="button"
                    onClick={() => setForm({ ...form, imageUrls: form.imageUrls.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {form.imageUrls.length < 3 ? (
                <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-white text-center">
                  <MaterialIcon className="text-primary text-[22px]" name="add_photo_alternate" />
                  <span className="text-[10px] font-bold text-primary">Tải ảnh</span>
                  <input
                    accept="image/*"
                    className="hidden"
                    multiple
                    type="file"
                    onChange={(e) => {
                      void handleImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-[#173A67]">Thành viên (chọn theo tên hoặc mã nhân viên)</span>
            {form.members.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <EmployeeSuggestInput
                    className="w-full rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-base sm:text-xs"
                    placeholder="Gõ tên hoặc mã NV để chọn"
                    searchUrl={MEMBER_SEARCH_URL}
                    value={m.fullName}
                    onChange={(text) => updateMember(i, { fullName: text })}
                    onPick={(emp) => updateMember(i, { fullName: emp.fullName, employeeCode: emp.employeeCode })}
                  />
                </div>
                <div className="w-28 shrink-0">
                  <EmployeeSuggestInput
                    align="right"
                    className="w-full rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-base sm:text-xs"
                    placeholder="Mã NV"
                    searchUrl={MEMBER_SEARCH_URL}
                    value={m.employeeCode}
                    onChange={(text) => updateMember(i, { employeeCode: text })}
                    onPick={(emp) => updateMember(i, { fullName: emp.fullName, employeeCode: emp.employeeCode })}
                  />
                </div>
                {form.members.length > 1 ? (
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-error hover:bg-error/10 text-xs cursor-pointer"
                    title="Xóa thành viên"
                    type="button"
                    onClick={() => setForm({ ...form, members: form.members.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            ))}
            <p className="text-[11px] text-on-surface-variant">
              Thành viên có tên trong bài được duyệt sẽ tính là người dự thi của chương trình.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-dusty-dark cursor-pointer disabled:opacity-50"
              disabled={saving}
              type="submit"
            >
              {saving ? "Đang lưu..." : form.id ? "Lưu thay đổi" : "Nộp bài"}
            </button>
            <button
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant cursor-pointer"
              type="button"
              onClick={() => setForm(null)}
            >
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      {user ? (
        loading && entries.length === 0 ? (
          <p className="text-xs text-on-surface-variant">Đang tải bài của bạn...</p>
        ) : entries.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-[#173A67]">Bài bạn đã nộp</h4>
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-outline-variant p-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#173A67]">{entry.title}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[entry.status]}`}>
                      {ENTRY_STATUS_LABEL[entry.status]}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {entry.members.map((m) => `${m.fullName}${m.employeeCode ? ` (${m.employeeCode})` : ""}`).join(", ")}
                  </p>
                  {entry.status === "rejected" && entry.reviewNote ? (
                    <p className="text-xs font-semibold text-rose-700">Lý do từ chối: {entry.reviewNote}</p>
                  ) : null}
                </div>
                {entry.status === "pending" ? (
                  <div className="flex gap-2">
                    {windowOpen ? (
                      <button
                        className="rounded-lg border border-primary px-3 py-1 text-xs font-bold text-primary cursor-pointer"
                        type="button"
                        onClick={() => startEdit(entry)}
                      >
                        Sửa
                      </button>
                    ) : null}
                    <button
                      className="rounded-lg border border-rose-400 px-3 py-1 text-xs font-bold text-rose-700 cursor-pointer"
                      type="button"
                      onClick={() => withdraw(entry)}
                    >
                      Rút bài
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null
      ) : null}
    </section>
  );
}
