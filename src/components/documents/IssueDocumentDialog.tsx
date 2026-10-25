"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { SCAN_LIMITS, isScanMimeType, type IssuedDocument } from "@/lib/documents/registry";
import { DOCUMENT_TYPE_LABEL, type DocumentType } from "@/lib/documents/templates";

const inputClass =
  "block h-9 w-full rounded-lg border border-outline-variant bg-white px-2.5 text-sm text-on-surface outline-none focus:border-[#173A67]";

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Hộp thoại Đánh dấu đã ban hành: số, ngày ban hành, bản scan đã ký và đóng dấu (tải lên từng phần qua API). */
export function IssueDocumentDialog({
  document: doc,
  defaultNumber,
  defaultDate,
  onClose,
  onIssued,
}: {
  document: { id: string; title: string; type: DocumentType };
  defaultNumber: string;
  defaultDate: string;
  onClose: () => void;
  onIssued: (issued: IssuedDocument) => void;
}) {
  const [soVanBan, setSoVanBan] = useState(defaultNumber);
  const [ngayBanHanh, setNgayBanHanh] = useState(defaultDate);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;

  function pickFile(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!isScanMimeType(next.type)) {
      setError("Chỉ nhận PDF hoặc ảnh (JPG, PNG, WEBP).");
      setFile(null);
      return;
    }
    if (next.size > SCAN_LIMITS.maxBytes) {
      setError(`Tệp ${formatSize(next.size)} vượt quá 10 MB.`);
      setFile(null);
      return;
    }
    setFile(next);
  }

  async function submit() {
    setError(null);
    if (!soVanBan.trim()) return setError("Vui lòng nhập số văn bản.");
    if (!ngayBanHanh) return setError("Vui lòng chọn ngày ban hành.");
    if (!file) return setError("Vui lòng chọn bản scan đã ký, đóng dấu.");

    const uploadId = crypto.randomUUID();
    const total = Math.ceil(file.size / SCAN_LIMITS.chunkBytes);
    try {
      for (let index = 0; index < total; index++) {
        setProgress(total > 1 ? `Đang tải bản scan ${index + 1}/${total}…` : "Đang tải bản scan…");
        const form = new FormData();
        form.append("chunk", file.slice(index * SCAN_LIMITS.chunkBytes, (index + 1) * SCAN_LIMITS.chunkBytes));
        form.append("index", String(index));
        form.append("total", String(total));
        form.append("uploadId", uploadId);
        form.append("mime", file.type);
        form.append("size", String(file.size));
        const res = await fetch(`/api/documents/drafts/${doc.id}/scan`, { method: "POST", body: form });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Không tải được bản scan lên.");
        }
      }
      setProgress("Đang ban hành…");
      const res = await fetch(`/api/documents/drafts/${doc.id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soVanBan, ngayBanHanh, uploadId, total, mime: file.type, size: file.size }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; document?: IssuedDocument };
      if (!res.ok || !data.document) throw new Error(data.error || "Không ban hành được văn bản.");
      onIssued(data.document);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không ban hành được văn bản.");
      setProgress(null);
    }
  }

  return (
    <div
      aria-labelledby="issue-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
    >
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-bg shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant bg-white px-4 py-2.5">
          <MaterialIcon className="text-[22px] text-emerald-700" name="verified" />
          <h2 className="min-w-0 flex-1 text-sm font-extrabold text-[#173A67]" id="issue-dialog-title">
            Đánh dấu đã ban hành
          </h2>
          <button
            aria-label="Đóng"
            className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40"
            disabled={busy}
            type="button"
            onClick={onClose}
          >
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5 overflow-y-auto px-4 py-3">
          <p className="text-xs text-on-surface-variant">
            {DOCUMENT_TYPE_LABEL[doc.type]}: <strong className="text-[#173A67]">{doc.title}</strong>
          </p>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant">
              Số văn bản <span className="text-error">*</span>
            </span>
            <input
              autoFocus
              className={inputClass}
              disabled={busy}
              maxLength={SCAN_LIMITS.number}
              placeholder="VD: 02-26/QĐ-CĐCS"
              value={soVanBan}
              onChange={(e) => setSoVanBan(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant">
              Ngày ban hành <span className="text-error">*</span>
            </span>
            <input
              className={inputClass}
              disabled={busy}
              type="date"
              value={ngayBanHanh}
              onChange={(e) => setNgayBanHanh(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant">
              Bản scan đã ký, đóng dấu (PDF hoặc ảnh, tối đa 10 MB) <span className="text-error">*</span>
            </span>
            <input
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="block w-full text-xs text-on-surface-variant file:mr-2 file:rounded-lg file:border file:border-[#173A67] file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-[#173A67] hover:file:bg-[#ecf4ff]"
              disabled={busy}
              type="file"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <span className="mt-1 block text-[11px] text-on-surface-variant">
                {file.name} • {formatSize(file.size)}
              </span>
            ) : null}
          </label>
          <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
            Sau khi ban hành, văn bản bị khóa: không sửa, không xóa ở trang Soạn văn bản. Chỉ Quản trị viên hủy ban hành được.
          </p>
          {error ? (
            <p className="rounded-lg border border-error/30 bg-error-container/40 px-2.5 py-1.5 text-xs font-semibold text-on-error-container">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-outline-variant bg-white px-4 py-2.5">
          {progress ? <span className="mr-auto text-xs text-on-surface-variant">{progress}</span> : null}
          <button
            className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:border-[#173A67] disabled:opacity-50"
            disabled={busy}
            type="button"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
            disabled={busy}
            type="button"
            onClick={() => void submit()}
          >
            <MaterialIcon className="text-[16px]" name="verified" />
            Ban hành
          </button>
        </div>
      </div>
    </div>
  );
}
