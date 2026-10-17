"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { QuizQuestionRow } from "@/lib/quiz-shared";

type Props = {
  questions: QuizQuestionRow[];
};

type FormValues = {
  content: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
};

const EMPTY_FORM: FormValues = {
  content: "",
  option_1: "",
  option_2: "",
  option_3: "",
  option_4: "",
  correct_option: 1,
};

const TEMPLATE_HEADER = [
  "STT",
  "Nội dung câu hỏi",
  "Đáp án 1",
  "Đáp án 2",
  "Đáp án 3",
  "Đáp án 4",
  "Câu trả lời",
];

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-[#173A67]";

function cellText(v: unknown) {
  return v == null ? "" : String(v).trim();
}

/** Chấp nhận 1–4 hoặc A–D (kể cả dạng "Đáp án 2"). */
function parseAnswer(v: unknown) {
  const s = cellText(v).toUpperCase();
  const digit = s.match(/[1-4]/);
  if (digit) return Number(digit[0]);
  const letter = s.match(/^[A-D]$/);
  if (letter) return "ABCD".indexOf(letter[0]) + 1;
  return null;
}

function isStrictAnswer(v: unknown) {
  return /^[1-4A-D]$/i.test(cellText(v));
}

/**
 * Đọc sheet đầu tiên theo format: STT | Nội dung câu hỏi | Đáp án 1..4 | Câu trả lời.
 * Nếu file không có cột STT (cột đầu là "Nội dung") thì tự lùi cột.
 */
function parseQuestionSheet(rows: unknown[][]) {
  const headerIndex = rows
    .slice(0, 5)
    .findIndex(
      (r) =>
        r.some((c) => /n[ộo]i dung|c[âa]u h[ỏo]i/i.test(cellText(c))) &&
        !isStrictAnswer(r[5]) &&
        !isStrictAnswer(r[6]),
    );
  let offset = 1;
  if (headerIndex >= 0) {
    if (/n[ộo]i dung|c[âa]u h[ỏo]i/i.test(cellText(rows[headerIndex][0]))) offset = 0;
  } else {
    const first = rows.find((r) => r.some((c) => cellText(c)));
    if (first && isStrictAnswer(first[5]) && !cellText(first[6])) offset = 0;
  }

  const items: (FormValues & { rowNumber: number })[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    if (i <= headerIndex) return;
    const cells = r.slice(offset, offset + 6).map(cellText);
    if (cells.every((c) => !c)) return;
    const rowNumber = i + 1;
    const correct = parseAnswer(r[offset + 5]);
    if (!cells[0]) {
      errors.push(`Dòng ${rowNumber}: thiếu nội dung câu hỏi.`);
      return;
    }
    if (cells.slice(1, 5).some((c) => !c)) {
      errors.push(`Dòng ${rowNumber}: cần đủ 4 đáp án.`);
      return;
    }
    if (correct === null) {
      errors.push(`Dòng ${rowNumber}: câu trả lời phải là 1, 2, 3 hoặc 4.`);
      return;
    }
    items.push({
      rowNumber,
      content: cells[0],
      option_1: cells[1],
      option_2: cells[2],
      option_3: cells[3],
      option_4: cells[4],
      correct_option: correct,
    });
  });
  return { items, errors };
}

export function AdminQuizQuestions({ questions }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const numbered = useMemo(() => questions.map((q, i) => ({ ...q, stt: i + 1 })), [questions]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return numbered;
    return numbered.filter((row) =>
      [row.content, row.option_1, row.option_2, row.option_3, row.option_4].some((t) =>
        t.toLowerCase().includes(q),
      ),
    );
  }, [numbered, search]);

  function openNew() {
    setEditingId("new");
    setForm(EMPTY_FORM);
    setError(null);
    setSuccess(null);
  }

  function openEdit(row: QuizQuestionRow) {
    setEditingId(row.id);
    setForm({
      content: row.content,
      option_1: row.option_1,
      option_2: row.option_2,
      option_3: row.option_3,
      option_4: row.option_4,
      correct_option: row.correct_option,
    });
    setError(null);
    setSuccess(null);
  }

  async function saveForm(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const isNew = editingId === "new";
      const res = await fetch("/api/quiz/questions", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? form : { ...form, id: editingId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể lưu câu hỏi.");
      setSuccess(json.message);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu câu hỏi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: QuizQuestionRow & { stt: number }) {
    if (!window.confirm(`Xóa câu hỏi số ${row.stt}?\n"${row.content.slice(0, 120)}"`)) return;
    setBusyId(row.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/quiz/questions?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể xóa câu hỏi.");
      setSuccess(json.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa câu hỏi.");
    } finally {
      setBusyId(null);
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADER,
      [1, "Công đoàn cơ sở được thành lập theo quy định của luật nào?", "Luật Lao động", "Luật Công đoàn", "Luật Doanh nghiệp", "Luật Dân sự", 2],
    ]);
    sheet["!cols"] = [{ wch: 6 }, { wch: 60 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 12 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Cau hoi");
    XLSX.writeFile(book, "mau_ngan_hang_cau_hoi.xlsx");
  }

  async function importFile(file: File) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    setImportErrors([]);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      if (!sheet) throw new Error("File Excel không có sheet nào.");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      const { items, errors } = parseQuestionSheet(rows);
      if (items.length === 0) {
        setImportErrors(errors);
        throw new Error("Không tìm thấy câu hỏi hợp lệ trong file. Hãy kiểm tra lại đúng format mẫu.");
      }
      if (
        !window.confirm(
          `Tìm thấy ${items.length} câu hỏi hợp lệ` +
            (errors.length ? ` (${errors.length} dòng lỗi sẽ bỏ qua)` : "") +
            `. Thêm vào ngân hàng câu hỏi?`,
        )
      ) {
        setImportErrors(errors);
        return;
      }
      const res = await fetch("/api/quiz/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể nhập câu hỏi.");
      setSuccess(json.message);
      setImportErrors([...errors, ...(json.invalid ?? [])]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đọc file Excel.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-title-md font-bold text-[#173A67]">
          <MaterialIcon className="text-[22px]" name="library_books" />
          Ngân hàng câu hỏi
          <span className="rounded-full bg-dusty-light px-2.5 py-0.5 text-xs font-bold text-primary">
            {questions.length} câu
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-tertiary px-4 py-2 text-sm font-bold text-on-tertiary disabled:opacity-60"
            disabled={busy}
            type="button"
            onClick={openNew}
          >
            <MaterialIcon className="text-[18px]" name="add" />
            Thêm câu hỏi
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#173A67] px-4 py-2 text-sm font-bold text-[#173A67] disabled:opacity-60"
            disabled={busy}
            type="button"
            onClick={() => fileRef.current?.click()}
          >
            <MaterialIcon className="text-[18px]" name="upload_file" />
            Nhập từ Excel
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant"
            type="button"
            onClick={() => void downloadTemplate()}
          >
            <MaterialIcon className="text-[18px]" name="download" />
            File mẫu
          </button>
          <input
            ref={fileRef}
            accept=".xlsx,.xls,.csv"
            className="hidden"
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
        </div>
      </div>

      <p className="text-xs text-on-surface-variant">
        Format Excel: <strong>STT | Nội dung câu hỏi | Đáp án 1 | Đáp án 2 | Đáp án 3 | Đáp án 4 | Câu trả lời</strong>{" "}
        (câu trả lời là số 1–4 ứng với đáp án đúng). Nhập từ Excel sẽ cộng thêm vào ngân hàng, câu trùng nội
        dung được bỏ qua.
      </p>

      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-[#D9F2EC] px-4 py-2 text-sm text-[#173A67]">{success}</p>
      ) : null}
      {importErrors.length > 0 ? (
        <details className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <summary className="cursor-pointer font-semibold">
            {importErrors.length} dòng bị bỏ qua khi nhập
          </summary>
          <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
            {importErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <input
        className={`${inputClass} max-w-sm`}
        placeholder="Tìm trong câu hỏi, đáp án..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-[#D9F2EC] text-[#173A67]">
            <tr>
              <th className="w-12 px-3 py-3">STT</th>
              <th className="px-3 py-3">Nội dung câu hỏi</th>
              <th className="px-3 py-3">Đáp án 1</th>
              <th className="px-3 py-3">Đáp án 2</th>
              <th className="px-3 py-3">Đáp án 3</th>
              <th className="px-3 py-3">Đáp án 4</th>
              <th className="w-24 px-3 py-3 text-center">Câu trả lời</th>
              <th className="w-32 px-3 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-on-surface-variant" colSpan={8}>
                  {questions.length === 0
                    ? "Chưa có câu hỏi nào. Bấm “Thêm câu hỏi” hoặc “Nhập từ Excel”."
                    : "Không có câu hỏi phù hợp."}
                </td>
              </tr>
            ) : null}
            {filtered.map((row) => {
              const options = [row.option_1, row.option_2, row.option_3, row.option_4];
              return (
                <tr key={row.id} className="border-t border-outline-variant align-top">
                  <td className="px-3 py-3 font-semibold text-[#173A67]">{row.stt}</td>
                  <td className="whitespace-pre-wrap px-3 py-3 font-medium text-on-surface">{row.content}</td>
                  {options.map((opt, i) => (
                    <td
                      key={i}
                      className={`px-3 py-3 ${
                        row.correct_option === i + 1
                          ? "font-bold text-emerald-700"
                          : "text-on-surface-variant"
                      }`}
                    >
                      {opt}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-800">
                      {row.correct_option}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg border border-[#173A67] px-3 py-1.5 text-xs font-bold text-[#173A67] disabled:opacity-50"
                        disabled={busyId === row.id}
                        type="button"
                        onClick={() => openEdit(row)}
                      >
                        Sửa
                      </button>
                      <button
                        className="rounded-lg border border-error px-3 py-1.5 text-xs font-bold text-error disabled:opacity-50"
                        disabled={busyId === row.id}
                        type="button"
                        onClick={() => void remove(row)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingId ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
        >
          <form
            className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onSubmit={saveForm}
          >
            <h3 className="text-title-md font-bold text-[#173A67]">
              {editingId === "new" ? "Thêm câu hỏi" : "Sửa câu hỏi"}
            </h3>
            <div>
              <label className="mb-1 block text-label-md" htmlFor="quizContent">
                Nội dung câu hỏi
              </label>
              <textarea
                required
                className={`${inputClass} min-h-[90px]`}
                id="quizContent"
                maxLength={1000}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([1, 2, 3, 4] as const).map((n) => {
                const key = `option_${n}` as const;
                return (
                  <div key={n}>
                    <label className="mb-1 block text-label-md" htmlFor={`quizOpt${n}`}>
                      Đáp án {n}
                    </label>
                    <input
                      required
                      className={inputClass}
                      id={`quizOpt${n}`}
                      maxLength={300}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                );
              })}
            </div>
            <div>
              <span className="mb-1 block text-label-md">Câu trả lời (đáp án đúng)</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    className={`h-10 w-10 rounded-full text-sm font-black ${
                      form.correct_option === n
                        ? "bg-emerald-600 text-white"
                        : "bg-surface-container text-[#173A67]"
                    }`}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, correct_option: n }))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant"
                disabled={busy}
                type="button"
                onClick={() => setEditingId(null)}
              >
                Hủy
              </button>
              <button
                className="rounded-xl bg-tertiary px-5 py-2 text-sm font-bold text-on-tertiary disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                {busy ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
