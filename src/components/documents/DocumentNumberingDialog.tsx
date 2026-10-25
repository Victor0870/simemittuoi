"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  NUMBERING_LIMITS,
  NUMBERING_RESET_LABEL,
  NUMBERING_TOKENS,
  formatDocumentNumber,
  numberingError,
  numberingPeriodLabel,
  type NumberingReset,
  type NumberingSeries,
  type NumberingStatus,
} from "@/lib/documents/numbering";
import { todayInVietnam } from "@/lib/documents/registry";
import { DOCUMENT_TYPE_LABEL, type DocumentType } from "@/lib/documents/templates";

const inputClass =
  "block h-8 w-full rounded-lg border border-outline-variant bg-white px-2 text-sm text-on-surface outline-none focus:border-[#173A67]";

type NumberingConfig = { series: NumberingSeries[]; status: Record<DocumentType, NumberingStatus> };

/**
 * Cấu hình số văn bản tự động theo loại: mẫu số, số chữ số, chu kỳ đếm lại, bắt đầu từ số (cho kỳ hiện tại).
 * Không đổi số đã ban hành; không cho đặt số bắt đầu nhỏ hơn hoặc bằng số đã cấp gần nhất trong kỳ.
 */
export function DocumentNumberingDialog({ onClose }: { onClose: () => void }) {
  const [series, setSeries] = useState<NumberingSeries[] | null>(null);
  const [baseline, setBaseline] = useState<NumberingConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const today = todayInVietnam();

  function applyConfig(config: NumberingConfig) {
    setBaseline(config);
    setSeries(config.series);
  }

  /** Cảnh báo lùi số: số bắt đầu đã đổi nhưng không lớn hơn số đã cấp gần nhất của kỳ hiện tại. */
  function startWarning(s: NumberingSeries): string | null {
    const before = baseline?.series.find((b) => b.type === s.type);
    const status = baseline?.status[s.type];
    if (!before || !status || before.reset !== s.reset || s.start === before.start) return null;
    if (s.start > status.lastIssued) return null;
    return (
      `Số bắt đầu phải lớn hơn ${status.lastIssued} – số đã cấp gần nhất trong ${numberingPeriodLabel(status.period)}. ` +
      "Không thể lùi số."
    );
  }

  /** Số tiếp theo theo cấu hình đang sửa: max(số bắt đầu, số đã cấp gần nhất + 1). */
  function nextNumber(s: NumberingSeries): string {
    const before = baseline?.series.find((b) => b.type === s.type);
    const last = before && before.reset === s.reset ? (baseline?.status[s.type].lastIssued ?? 0) : 0;
    return formatDocumentNumber(s.format.trim(), s.pad, Math.max(s.start, last + 1), today);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/documents/numbering", { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as Partial<NumberingConfig> & { error?: string };
        if (!res.ok || !data.series || !data.status) throw new Error(data.error || "Không tải được cấu hình số văn bản.");
        applyConfig({ series: data.series, status: data.status });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Không tải được cấu hình số văn bản.");
      });
    return () => controller.abort();
  }, []);

  function update(index: number, patch: Partial<NumberingSeries>) {
    setSaved(false);
    setSeries((list) => (list ? list.map((s, i) => (i === index ? { ...s, ...patch } : s)) : list));
  }

  async function save() {
    if (!series) return;
    setError(null);
    const invalid = series.find((s) => numberingError(s) || startWarning(s));
    if (invalid) {
      return setError(`${DOCUMENT_TYPE_LABEL[invalid.type]}: ${numberingError(invalid) ?? startWarning(invalid)}`);
    }
    setSaving(true);
    try {
      const res = await fetch("/api/documents/numbering", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<NumberingConfig> & { error?: string };
      if (!res.ok || !data.series || !data.status) throw new Error(data.error || "Không lưu được cấu hình số văn bản.");
      applyConfig({ series: data.series, status: data.status });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được cấu hình số văn bản.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      aria-labelledby="numbering-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
    >
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-bg shadow-xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant bg-white px-4 py-2.5">
          <MaterialIcon className="text-[22px] text-[#173A67]" name="pin" />
          <h2 className="min-w-0 flex-1 text-sm font-extrabold text-[#173A67]" id="numbering-dialog-title">
            Cấu hình số văn bản tự động
          </h2>
          <button
            aria-label="Đóng"
            className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40"
            disabled={saving}
            type="button"
            onClick={onClose}
          >
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5 overflow-y-auto px-4 py-3">
          <p className="text-xs text-on-surface-variant">
            Số được cấp ở máy chủ lúc ban hành, theo thứ tự, không trùng. Biến dùng được:{" "}
            {NUMBERING_TOKENS.map((t, i) => (
              <span key={t.token}>
                {i ? ", " : ""}
                <code className="rounded bg-white px-1 font-semibold text-[#173A67]">{t.token}</code> {t.label.toLowerCase()}
              </span>
            ))}
            . Đổi cấu hình không làm thay đổi số của văn bản đã ban hành.
          </p>
          <p className="rounded-lg bg-[#ecf4ff] px-2.5 py-1.5 text-[11px] text-[#173A67]">
            <strong>Bắt đầu từ số</strong> dùng khi chuyển từ sổ văn bản giấy sang web, áp dụng cho kỳ đếm hiện tại: VD số
            giấy cuối cùng là 37 thì nhập 38. Số tiếp theo luôn lớn hơn số đã cấp gần nhất trong kỳ, không lùi số được.
          </p>

          {series === null && !error ? <p className="py-6 text-center text-xs text-on-surface-variant">Đang tải…</p> : null}

          {series?.map((s, index) => {
            const rowError = numberingError(s);
            const warning = rowError ? null : startWarning(s);
            const status = baseline?.status[s.type];
            const resetChanged = baseline?.series.find((b) => b.type === s.type)?.reset !== s.reset;
            return (
              <fieldset key={s.type} className="rounded-xl border border-[#d2dfe9] bg-white px-3 py-2">
                <legend className="px-1 text-xs font-bold text-[#173A67]">{DOCUMENT_TYPE_LABEL[s.type]}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_76px_96px_172px]">
                  <label className="col-span-2 block sm:col-span-1">
                    <span className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant">Mẫu số</span>
                    <input
                      className={inputClass}
                      disabled={saving}
                      maxLength={NUMBERING_LIMITS.formatMax}
                      value={s.format}
                      onChange={(e) => update(index, { format: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant">Số chữ số</span>
                    <select
                      className={inputClass}
                      disabled={saving}
                      value={s.pad}
                      onChange={(e) => update(index, { pad: Number(e.target.value) })}
                    >
                      {Array.from({ length: NUMBERING_LIMITS.padMax }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} ({formatDocumentNumber("{so}", n, 1, today)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant">Bắt đầu từ số</span>
                    <input
                      className={`${inputClass} tabular-nums ${warning ? "border-error focus:border-error" : ""}`}
                      disabled={saving}
                      inputMode="numeric"
                      max={NUMBERING_LIMITS.startMax}
                      min={1}
                      step={1}
                      title="Áp dụng cho kỳ đếm hiện tại, VD số giấy cuối cùng là 37 thì nhập 38"
                      type="number"
                      value={Number.isFinite(s.start) && s.start > 0 ? s.start : ""}
                      onChange={(e) => update(index, { start: e.target.value === "" ? 0 : Number(e.target.value) })}
                    />
                  </label>
                  <label className="col-span-2 block sm:col-span-1">
                    <span className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant">Chu kỳ đếm</span>
                    <select
                      className={inputClass}
                      disabled={saving}
                      value={s.reset}
                      onChange={(e) => update(index, { reset: e.target.value as NumberingReset })}
                    >
                      {(Object.keys(NUMBERING_RESET_LABEL) as NumberingReset[]).map((r) => (
                        <option key={r} value={r}>
                          {NUMBERING_RESET_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {rowError || warning ? (
                  <p className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-error" role="alert">
                    <MaterialIcon className="text-[14px]" name="warning" />
                    {rowError ?? warning}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-on-surface-variant">
                    {status && !resetChanged ? (
                      <>
                        Kỳ hiện tại ({numberingPeriodLabel(status.period)}):{" "}
                        {status.lastIssued > 0 ? (
                          <>
                            đã cấp gần nhất số <strong className="tabular-nums text-[#173A67]">{status.lastIssued}</strong>
                          </>
                        ) : (
                          "chưa cấp số nào"
                        )}
                        {" · "}
                      </>
                    ) : resetChanged ? (
                      "Chu kỳ mới áp dụng từ kỳ hiện tại · "
                    ) : null}
                    Số tiếp theo: <strong className="tabular-nums text-[#173A67]">{nextNumber(s)}</strong>
                  </p>
                )}
              </fieldset>
            );
          })}

          {error ? (
            <p className="rounded-lg border border-error/30 bg-error-container/40 px-2.5 py-1.5 text-xs font-semibold text-on-error-container">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-outline-variant bg-white px-4 py-2.5">
          {saved ? <span className="mr-auto text-xs font-semibold text-emerald-700">Đã lưu cấu hình.</span> : null}
          <button
            className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:border-[#173A67] disabled:opacity-50"
            disabled={saving}
            type="button"
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-50"
            disabled={saving || !series || series.some((s) => numberingError(s) || startWarning(s))}
            type="button"
            onClick={() => void save()}
          >
            <MaterialIcon className="text-[16px]" name="save" />
            {saving ? "Đang lưu…" : "Lưu cấu hình"}
          </button>
        </div>
      </div>
    </div>
  );
}
