"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { CategoryKind } from "@/lib/finance/registry";
import type {
  FinanceImportCommitResult,
  FinanceImportPreviewResult,
  FinanceImportPreviewRow,
} from "@/lib/finance/summary-excel";
import { formatVnd } from "@/lib/visits/registry";

const FINANCE_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

type Step = "choose" | "preview" | "result";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = `${buttonBase} border-outline-variant bg-white text-[#173A67] hover:border-[#173A67] hover:bg-[#173A67]/5`;
const primaryButton = `${buttonBase} border-[#173A67] bg-[#173A67] text-white hover:bg-[#1E4A7D]`;

async function readApiError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || fallback;
}

function buildPreviewColumns(kind: CategoryKind): DataTableColumn<FinanceImportPreviewRow>[] {
  const isIncome = kind === "income";
  const kindNoun = isIncome ? "thu" : "chi";
  const amountColor = isIncome ? "text-emerald-700" : "text-rose-700";

  return [
    {
      key: "row",
      header: "Dòng",
      type: "number",
      className: "whitespace-nowrap text-on-surface-variant",
    },
    {
      key: "entryDateDisplay",
      header: "Ngày",
      className: "whitespace-nowrap font-medium",
    },
    {
      key: "categoryName",
      header: `Danh mục ${kindNoun}`,
      className: "min-w-[190px] font-medium text-[#173A67]",
    },
    {
      key: "content",
      header: `Nội dung ${kindNoun}`,
      className: "min-w-[230px]",
      render: (r) => r.content || "—",
    },
    {
      key: "amount",
      header: `Số tiền ${kindNoun}`,
      type: "number",
      headerClassName: "text-right",
      className: "whitespace-nowrap text-right font-bold",
      render: (r) =>
        r.amount !== null ? <span className={amountColor}>{formatVnd(r.amount)}</span> : "—",
    },
    {
      key: "note",
      header: "Ghi chú",
      className: "min-w-[140px] text-xs text-on-surface-variant",
      render: (r) => r.note ?? "—",
    },
    {
      key: "errors",
      header: "Kiểm tra",
      accessor: (r) => (r.errors.length ? r.errors.join(" ") : "Hợp lệ"),
      className: "min-w-[240px]",
      render: (r) =>
        r.errors.length > 0 ? (
          <ul className="space-y-0.5 text-xs font-medium text-rose-700">
            {r.errors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <MaterialIcon className="text-[15px]" name="check_circle" />
            Hợp lệ
          </span>
        ),
    },
  ];
}

export function FinanceImportModal({ kind }: { kind: CategoryKind }) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FinanceImportPreviewResult | null>(null);
  const [result, setResult] = useState<FinanceImportCommitResult | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isIncome = kind === "income";
  const kindNoun = isIncome ? "thu" : "chi";
  const previewColumns = useMemo(() => buildPreviewColumns(kind), [kind]);

  const counts = useMemo(() => {
    const rows = preview?.rows ?? [];
    const validRows = rows.filter((r) => r.errors.length === 0);
    const errorRows = rows.filter((r) => r.errors.length > 0);
    const totalAmount = validRows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    return {
      valid: validRows.length,
      error: errorRows.length,
      totalAmount,
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
      setError("Chỉ hỗ trợ file Excel định dạng .xlsx.");
      e.target.value = "";
      return;
    }
    if (picked && picked.size > FINANCE_IMPORT_MAX_BYTES) {
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      const res = await fetch(`/api/finance/summary/import/preview?kind=${kind}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        setError(await readApiError(res, "Không đọc được file Excel, vui lòng thử lại."));
        return;
      }
      const data = (await res.json()) as FinanceImportPreviewResult;
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
        `Xác nhận lưu ${counts.valid} khoản ${kindNoun} hợp lệ vào sổ quỹ công đoàn?`,
      )
    ) {
      return;
    }
    setBusy("commit");
    setError(null);
    try {
      const rows = preview.rows
        .filter((r) => r.errors.length === 0)
        .map((r) => ({
          row: r.row,
          entryDate: r.entryDate,
          kind,
          categoryId: r.categoryId,
          content: r.content,
          amount: r.amount,
          note: r.note,
        }));
      const res = await fetch(`/api/finance/summary/import/commit?kind=${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, rows }),
      });
      if (!res.ok) {
        setError(await readApiError(res, `Không lưu được dữ liệu khoản ${kindNoun}, vui lòng thử lại.`));
        return;
      }
      const data = (await res.json()) as FinanceImportCommitResult;
      setResult(data);
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
        <MaterialIcon className="text-[18px]" name="upload_file" />
        <span>Nhập Excel khoản {kindNoun}</span>
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
          <div className="flex max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-outline-variant bg-white text-sm shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
              <h2 className="flex items-center gap-2 text-base font-bold text-[#173A67]" id={titleId}>
                <MaterialIcon className="text-[20px] text-[#173A67]" name="upload_file" />
                Nhập các khoản {kindNoun} từ Excel (.xlsx)
              </h2>
              <button
                aria-label="Đóng"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-40"
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
                  <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs leading-relaxed text-sky-950">
                    <p className="font-bold text-[#173A67]">
                      Cấu trúc 5 cột chuẩn của file mẫu khoản {kindNoun}:
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      <li>
                        <strong>Ngày</strong>: định dạng <code>dd/mm/yyyy</code> (ví dụ <code>15/10/2026</code>) hoặc{" "}
                        <code>yyyy-mm-dd</code>.
                      </li>
                      <li>
                        <strong>Danh mục {kindNoun}</strong>: tên hoặc mã danh mục {kindNoun} đang có trong hệ thống (xem
                        trang tính <em>Danh mục {kindNoun} &amp; Hướng dẫn</em> trong file mẫu).
                      </li>
                      <li>
                        <strong>Nội dung {kindNoun}</strong>: diễn giải chi tiết khoản {kindNoun} (bắt buộc).
                      </li>
                      <li>
                        <strong>Số tiền {kindNoun}</strong>: số tiền nguyên dương (VNĐ).
                      </li>
                      <li>
                        <strong>Ghi chú</strong>: ghi chú bổ sung (tùy chọn).
                      </li>
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#173A67]/30 bg-[#173A67]/5 px-3.5 py-2 text-sm font-bold text-[#173A67] hover:bg-[#173A67]/10"
                      href={`/api/finance/summary/import/template?kind=${kind}`}
                    >
                      <MaterialIcon className="text-[18px]" name="download" />
                      Tải file mẫu nhập {kindNoun} (.xlsx)
                    </a>
                    <span className="text-xs text-on-surface-variant">
                      Hệ thống sẽ kiểm tra lỗi từng dòng và hiển thị bản xem trước trước khi lưu.
                    </span>
                  </div>

                  <label className="block cursor-pointer rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-4 hover:border-[#173A67]">
                    <span className="mb-2 block font-semibold text-[#173A67]">
                      Chọn file Excel khoản {kindNoun} (.xlsx) từ máy tính
                    </span>
                    <input
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#173A67] file:px-3 file:py-1.5 file:font-semibold file:text-white"
                      disabled={busy !== null}
                      type="file"
                      onChange={onFileChange}
                    />
                  </label>
                </>
              ) : null}

              {step === "preview" && preview ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="font-bold text-emerald-700">{counts.valid} dòng hợp lệ</span>
                      <span className="font-bold text-rose-700">{counts.error} dòng lỗi</span>
                      <span className="text-xs text-on-surface-variant">
                        Tổng tiền {kindNoun} hợp lệ:{" "}
                        <strong className={isIncome ? "text-emerald-700" : "text-rose-700"}>
                          {formatVnd(counts.totalAmount)}
                        </strong>
                      </span>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-on-surface-variant">
                      <input
                        checked={onlyErrors}
                        className="h-4 w-4 accent-[#173A67]"
                        type="checkbox"
                        onChange={(e) => setOnlyErrors(e.target.checked)}
                      />
                      Chỉ xem dòng lỗi ({counts.error})
                    </label>
                  </div>

                  <DataTable
                    columns={previewColumns}
                    defaultPageSize={20}
                    emptyText={onlyErrors ? "Không có dòng lỗi nào." : "Không có dữ liệu."}
                    maxHeightClass="max-h-[52dvh] min-h-[180px]"
                    rowClassName={(r) => (r.errors.length > 0 ? "bg-rose-50/70" : "")}
                    rowKey={(r) => String(r.row)}
                    rows={visibleRows}
                  />
                </>
              ) : null}

              {step === "result" && result ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
                    <MaterialIcon className="text-[24px] text-emerald-600" name="check_circle" />
                    <div>
                      <p className="font-bold">
                        Đã nhập thành công {result.imported} khoản {kindNoun} vào sổ quỹ công đoàn
                        {result.skipped > 0 ? ` (bỏ qua ${result.skipped} dòng)` : ""}.
                      </p>
                      <p className="text-xs text-emerald-800">
                        Bảng Tổng hợp {kindNoun} đã được cập nhật tự động theo dữ liệu vừa nhập.
                      </p>
                    </div>
                  </div>
                  {result.errors.length > 0 ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <p className="mb-1 font-semibold text-rose-800">Chi tiết các dòng bị bỏ qua:</p>
                      <ul className="max-h-56 space-y-1 overflow-y-auto text-xs text-rose-700">
                        {result.errors.map((e, i) => (
                          <li key={i}>
                            Dòng {e.row}: {e.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <p
                  className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 font-medium text-rose-700"
                  role="alert"
                >
                  <MaterialIcon className="text-[18px]" name="error" />
                  <span>{error}</span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant px-4 py-3 sm:px-5">
              {step === "choose" ? (
                <>
                  <button className={secondaryButton} disabled={busy !== null} type="button" onClick={close}>
                    Hủy
                  </button>
                  <button
                    className={primaryButton}
                    disabled={!file || busy !== null}
                    type="button"
                    onClick={() => void handlePreview()}
                  >
                    <MaterialIcon className="text-[18px]" name={busy === "preview" ? "hourglass_top" : "preview"} />
                    {busy === "preview" ? "Đang kiểm tra file..." : "Xem trước & Kiểm tra lỗi"}
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
                    onClick={() => void handleCommit()}
                  >
                    <MaterialIcon className="text-[18px]" name={busy === "commit" ? "hourglass_top" : "task_alt"} />
                    {busy === "commit" ? "Đang lưu..." : `Xác nhận lưu ${counts.valid} khoản ${kindNoun}`}
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
