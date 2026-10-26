"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { QuizProgramRow } from "@/lib/quiz-shared";

export type QuizProgramCard = QuizProgramRow & {
  questionsCount: number;
  sessionsCount: number;
  isOpen: boolean;
};

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-[#173A67]";

/** Trang hub Trắc nghiệm: danh sách chương trình dạng thẻ + form tạo chương trình mới. */
export function AdminQuizPrograms({ programs }: { programs: QuizProgramCard[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setDescription("");
    setIsActive(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Vui lòng nhập tên chương trình.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/quiz/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể tạo chương trình.");
      setSuccess(json.message);
      resetForm();
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo chương trình.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Thi trắc nghiệm</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Mỗi chương trình có cài đặt, đợt thi, ngân hàng câu hỏi và bảng xếp hạng riêng.
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-amber-600"
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setError(null);
            setSuccess(null);
          }}
        >
          <MaterialIcon className="text-[20px]" name={showForm ? "close" : "add_circle"} />
          {showForm ? "Đóng" : "Thêm chương trình trắc nghiệm"}
        </button>
      </div>

      {success ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
          <MaterialIcon className="shrink-0 text-[22px] text-emerald-600" name="check_circle" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      ) : null}

      {showForm ? (
        <form
          className="space-y-4 rounded-2xl border border-border-subtle bg-white p-5 shadow-xs"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <h2 className="text-title-md font-bold text-[#173A67]">Chương trình trắc nghiệm mới</h2>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-on-surface">
              Tên chương trình <span className="text-error">*</span>
            </span>
            <input
              className={inputClass}
              maxLength={150}
              placeholder="Ví dụ: Tìm hiểu Luật Công đoàn 2024"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-on-surface">Mô tả</span>
            <textarea
              className={`${inputClass} min-h-24`}
              maxLength={2000}
              placeholder="Giới thiệu ngắn về chương trình (không bắt buộc)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <input
              checked={isActive}
              className="h-4 w-4 accent-[#173A67]"
              type="checkbox"
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active — chương trình đang hoạt động
          </label>
          {error ? <p className="text-sm font-medium text-error">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
              disabled={busy}
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
                setError(null);
              }}
            >
              Hủy
            </button>
            <button
              className="flex items-center gap-2 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#27496D] disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {busy ? <MaterialIcon className="animate-spin text-[18px]" name="progress_activity" /> : null}
              Tạo chương trình
            </button>
          </div>
        </form>
      ) : null}

      {programs.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-white p-6 text-center text-sm text-on-surface-variant">
          Chưa có chương trình trắc nghiệm nào.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <Link
              prefetch={false}
              key={p.id}
              className="group flex items-start gap-3.5 rounded-2xl border border-border-subtle bg-white p-5 transition hover:border-primary hover:shadow-md"
              href={`/admin/quiz/${p.id}`}
            >
              <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-surface-container text-[#173A67]">
                <MaterialIcon className="text-[24px]" name="quiz" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-on-surface transition-colors group-hover:text-primary">{p.name}</p>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {p.isOpen ? (
                      <span className="whitespace-nowrap rounded-full bg-amber-light px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        Đang mở
                      </span>
                    ) : null}
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        p.is_active ? "bg-emerald-100 text-emerald-800" : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                {p.description ? (
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">{p.description}</p>
                ) : null}
                <p className="mt-2 text-xs font-semibold text-[#27496D]">
                  {p.questionsCount} câu hỏi · {p.sessionsCount} đợt thi
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
