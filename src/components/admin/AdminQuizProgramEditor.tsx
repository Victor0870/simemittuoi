"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { QuizProgramRow } from "@/lib/quiz-shared";

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-[#173A67]";

/** Thông tin chương trình trắc nghiệm: sửa tên, mô tả, Active; xóa khi chưa có lượt làm bài. */
export function AdminQuizProgramEditor({ program, canDelete }: { program: QuizProgramRow; canDelete: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description ?? "");
  const [isActive, setIsActive] = useState(program.is_active);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function startEdit() {
    setName(program.name);
    setDescription(program.description ?? "");
    setIsActive(program.is_active);
    setError(null);
    setSuccess(null);
    setEditing(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Vui lòng nhập tên chương trình.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const res = await fetch("/api/quiz/programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: program.id, name, description, isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể lưu chương trình.");
      setSuccess(json.message);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu chương trình.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Xóa chương trình "${program.name}" cùng ngân hàng câu hỏi và các đợt thi trống của nó?`)) {
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/quiz/programs?id=${encodeURIComponent(program.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể xóa chương trình.");
      router.push("/admin/quiz");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa chương trình.");
      setBusy(null);
    }
  }

  if (!editing) {
    return (
      <section className="space-y-3 rounded-2xl border border-border-subtle bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-title-md font-bold text-[#173A67]">Thông tin chương trình</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-on-surface-variant">
              {program.description || "Chưa có mô tả."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#27496D]"
              type="button"
              onClick={startEdit}
            >
              <MaterialIcon className="text-[18px]" name="edit" />
              Sửa chương trình
            </button>
            {canDelete ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                disabled={busy !== null}
                type="button"
                onClick={() => void handleDelete()}
              >
                <MaterialIcon className="text-[18px]" name="delete" />
                {busy === "delete" ? "Đang xóa..." : "Xóa chương trình"}
              </button>
            ) : null}
          </div>
        </div>
        {success ? <p className="rounded-xl bg-[#D9F2EC] px-4 py-2 text-sm text-[#173A67]">{success}</p> : null}
        {error ? <p className="text-sm font-medium text-error">{error}</p> : null}
      </section>
    );
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-border-subtle bg-white p-5"
      onSubmit={(e) => void handleSave(e)}
    >
      <h2 className="text-title-md font-bold text-[#173A67]">Sửa chương trình</h2>
      <label className="block space-y-1 text-sm">
        <span className="font-semibold text-on-surface">
          Tên chương trình <span className="text-error">*</span>
        </span>
        <input className={inputClass} maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-semibold text-on-surface">Mô tả</span>
        <textarea
          className={`${inputClass} min-h-24`}
          maxLength={2000}
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
        Active — hiện chương trình cho đoàn viên
      </label>
      {error ? <p className="text-sm font-medium text-error">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
          disabled={busy !== null}
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Hủy
        </button>
        <button
          className="flex items-center gap-2 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#27496D] disabled:opacity-60"
          disabled={busy !== null}
          type="submit"
        >
          {busy === "save" ? <MaterialIcon className="animate-spin text-[18px]" name="progress_activity" /> : null}
          Lưu
        </button>
      </div>
    </form>
  );
}
