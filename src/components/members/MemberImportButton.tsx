"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type {
  ImportCommitResult,
  ImportPreviewResult,
  ImportPreviewRow,
} from "@/lib/members/profile-import";

const MAX_BYTES = 2 * 1024 * 1024;

type Step = "choose" | "preview" | "result";

const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = `${buttonClass} border-[#d2dfe9] bg-white text-[#4a6b82] hover:bg-[#ecf4ff]`;
const primaryButton = `${buttonClass} border-[#4a6b82] bg-[#4a6b82] text-white hover:bg-[#173A67]`;

function rowStatus(r: ImportPreviewRow): "valid" | "error" | "unchanged" {
  if (r.errors.length > 0) return "error";
  return r.changes.length > 0 ? "valid" : "unchanged";
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || fallback;
}

const previewColumns: DataTableColumn<ImportPreviewRow>[] = [
  {
    key: "row",
    header: "Dòng",
    type: "number",
    className: "whitespace-nowrap text-on-surface-variant",
  },
  {
    key: "employee_code",
    header: "Mã NV",
    className: "whitespace-nowrap font-semibold text-[#173A67]",
    render: (r) => r.employee_code ?? "—",
  },
  {
    key: "member_name",
    header: "Họ tên",
    className: "whitespace-nowrap",
    render: (r) => r.member_name ?? "—",
  },
  {
    key: "changes",
    header: "Thay đổi",
    accessor: (r) => r.changes.map((c) => c.label).join(", "),
    className: "min-w-[260px]",
    render: (r) =>
      r.changes.length === 0 ? (
        <span className="text-on-surface-variant">—</span>
      ) : (
        <ul className="space-y-0.5 text-xs">
          {r.changes.map((c) => (
            <li key={c.field}>
              <strong className="font-semibold text-[#173A67]">{c.label}:</strong>{" "}
              <span className="text-on-surface-variant">{c.old ?? "(trống)"}</span> =&gt;{" "}
              <span className="font-semibold">{c.new ?? "(trống)"}</span>
            </li>
          ))}
        </ul>
      ),
  },
  {
    key: "errors",
    header: "Lỗi",
    accessor: (r) => (r.errors.length ? r.errors.join(" ") : r.changes.length ? "" : "Không thay đổi"),
    className: "min-w-[220px]",
    render: (r) =>
      r.errors.length > 0 ? (
        <ul className="space-y-0.5 text-xs font-medium text-red-700">
          {r.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : r.changes.length === 0 ? (
        <span className="text-xs text-on-surface-variant">Không thay đổi</span>
      ) : (
        <span className="text-xs text-emerald-700">Hợp lệ</span>
      ),
  },
];

export function MemberImportButton() {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const rows = preview?.rows ?? [];
    return {
      valid: rows.filter((r) => rowStatus(r) === "valid").length,
      error: rows.filter((r) => rowStatus(r) === "error").length,
      unchanged: rows.filter((r) => rowStatus(r) === "unchanged").length,
    };
  }, [preview]);

  const visibleRows = useMemo(
    () => (preview?.rows ?? []).filter((r) => !onlyErrors || r.errors.length > 0),
    [preview, onlyErrors],
  );

  function reset() {
    setStep("choose");
    setFile(null);
    setPreview(null);
    setResult(null);
    setOnlyErrors(false);
    setError(null);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    reset();
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setOpen(false);
        reset();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setError(null);
    if (picked && !picked.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setError("Chỉ nhận file Excel định dạng .xlsx.");
      e.target.value = "";
      return;
    }
    if (picked && picked.size > MAX_BYTES) {
      setFile(null);
      setError("File vượt quá 2 MB.");
      e.target.value = "";
      return;
    }
    setFile(picked);
  }

  async function handlePreview() {
    if (!file) return;
    setBusy("preview");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/members/import/preview", { method: "POST", body });
      if (!res.ok) {
        setError(await readError(res, "Không đọc được file, vui lòng thử lại."));
        return;
      }
      const data = (await res.json()) as ImportPreviewResult;
      setPreview(data);
      setOnlyErrors(false);
      setStep("preview");
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCommit() {
    if (!preview || counts.valid === 0) return;
    if (
      !window.confirm(
        `Cập nhật hồ sơ của ${counts.valid} đoàn viên? Mọi thay đổi được ghi vào lịch sử hồ sơ như khi sửa tay.`,
      )
    ) {
      return;
    }
    setBusy("commit");
    setError(null);
    try {
      const rows = preview.rows
        .filter((r) => rowStatus(r) === "valid")
        .map((r) => ({ row: r.row, employee_code: r.employee_code, details: r.details }));
      const res = await fetch("/api/members/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        setError(await readError(res, "Không cập nhật được hồ sơ, vui lòng thử lại."));
        return;
      }
      setResult((await res.json()) as ImportCommitResult);
      setStep("result");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button className={secondaryButton} type="button" onClick={() => setOpen(true)}>
        <MaterialIcon className="text-[18px]" name="upload" />
        <span>Nhập Excel</span>
      </button>

      {open ? (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          role="dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-[#d2dfe9] bg-white text-sm shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#d2dfe9] px-4 py-3 sm:px-5">
              <h2 className="flex items-center gap-2 text-base font-bold text-[#173A67]" id={titleId}>
                <MaterialIcon className="text-[20px] text-[#4a6b82]" name="upload" />
                Nhập hồ sơ từ Excel
              </h2>
              <button
                aria-label="Đóng"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#4a6b82] hover:bg-[#ecf4ff] disabled:opacity-40"
                disabled={busy !== null}
                type="button"
                onClick={close}
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              {step === "choose" ? (
                <>
                  <ul className="list-disc space-y-1 pl-5 text-on-surface-variant">
                    <li>
                      Mỗi dòng là một đoàn viên, tìm theo <strong>Mã NV</strong>; các cột còn lại là thông tin hồ sơ
                      (ngày sinh, giới tính, điện thoại, địa chỉ, hôn nhân, tài khoản ngân hàng).
                    </li>
                    <li>Ô để trống được giữ nguyên giá trị đang lưu. Ngày nhập dạng dd/mm/yyyy.</li>
                    <li>Không nhập được số CCCD, thông tin con, vai trò, điểm hay tài khoản.</li>
                    <li>File .xlsx tối đa 2 MB, 2000 dòng. Bạn sẽ được xem trước trước khi cập nhật.</li>
                  </ul>
                  <a
                    className="inline-flex items-center gap-1 font-semibold text-[#4a6b82] hover:text-[#173A67] hover:underline"
                    href="/api/members/import/template"
                  >
                    <MaterialIcon className="text-[18px]" name="download" />
                    Tải file mẫu
                  </a>
                  <label className="block rounded-xl border border-dashed border-[#d2dfe9] bg-[#f7fafd] p-4">
                    <span className="mb-2 block font-semibold text-[#173A67]">Chọn file Excel (.xlsx)</span>
                    <input
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#4a6b82] file:px-3 file:py-1.5 file:font-semibold file:text-white"
                      disabled={busy !== null}
                      type="file"
                      onChange={onFileChange}
                    />
                  </label>
                </>
              ) : null}

              {step === "preview" && preview ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="font-semibold">
                      <span className="text-emerald-700">{counts.valid} dòng hợp lệ</span>,{" "}
                      <span className="text-red-700">{counts.error} dòng lỗi</span>,{" "}
                      <span className="text-on-surface-variant">{counts.unchanged} dòng không thay đổi</span>
                    </p>
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        checked={onlyErrors}
                        className="h-4 w-4 accent-[#4a6b82]"
                        type="checkbox"
                        onChange={(e) => setOnlyErrors(e.target.checked)}
                      />
                      Chỉ xem dòng lỗi
                    </label>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Cột nhận diện: {preview.columns.join(", ")}. Chỉ các dòng hợp lệ được cập nhật; dòng lỗi bị bỏ qua.
                  </p>
                  <DataTable
                    columns={previewColumns}
                    defaultPageSize={20}
                    emptyText={onlyErrors ? "Không có dòng lỗi." : "Không có dòng dữ liệu."}
                    maxHeightClass="max-h-[50dvh] min-h-[160px]"
                    rowClassName={(r) => (r.errors.length > 0 ? "bg-red-50/60" : "")}
                    rowKey={(r) => String(r.row)}
                    rows={visibleRows}
                  />
                </>
              ) : null}

              {step === "result" && result ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
                    <MaterialIcon className="text-[24px] text-emerald-600" name="check_circle" />
                    <p className="font-semibold">
                      Đã cập nhật {result.updated} hồ sơ
                      {result.skipped > 0 ? `, bỏ qua ${result.skipped} dòng` : ""}.
                    </p>
                  </div>
                  {result.errors.length > 0 ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="mb-1 font-semibold text-red-800">Các dòng không cập nhật được:</p>
                      <ul className="max-h-60 space-y-1 overflow-y-auto text-xs text-red-700">
                        {result.errors.map((e, i) => (
                          <li key={i}>
                            {e.row ? `Dòng ${e.row}` : "Dòng ?"}
                            {e.employee_code ? ` (${e.employee_code})` : ""}: {e.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 font-medium text-red-700" role="alert">
                  <MaterialIcon className="text-[18px]" name="error" />
                  <span>{error}</span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#d2dfe9] px-4 py-3 sm:px-5">
              {step === "choose" ? (
                <>
                  <button className={secondaryButton} disabled={busy !== null} type="button" onClick={close}>
                    Hủy
                  </button>
                  <button className={primaryButton} disabled={!file || busy !== null} type="button" onClick={handlePreview}>
                    <MaterialIcon className="text-[18px]" name={busy === "preview" ? "hourglass_top" : "preview"} />
                    {busy === "preview" ? "Đang đọc file..." : "Xem trước"}
                  </button>
                </>
              ) : null}
              {step === "preview" ? (
                <>
                  <button
                    className={`${secondaryButton} mr-auto`}
                    disabled={busy !== null}
                    type="button"
                    onClick={reset}
                  >
                    <MaterialIcon className="text-[18px]" name="arrow_back" />
                    Chọn file khác
                  </button>
                  <button className={secondaryButton} disabled={busy !== null} type="button" onClick={close}>
                    Hủy
                  </button>
                  <button
                    className={primaryButton}
                    disabled={counts.valid === 0 || busy !== null}
                    type="button"
                    onClick={handleCommit}
                  >
                    <MaterialIcon className="text-[18px]" name={busy === "commit" ? "hourglass_top" : "task_alt"} />
                    {busy === "commit" ? "Đang cập nhật..." : `Xác nhận cập nhật ${counts.valid} hồ sơ`}
                  </button>
                </>
              ) : null}
              {step === "result" ? (
                <button className={primaryButton} type="button" onClick={close}>
                  Đóng
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
