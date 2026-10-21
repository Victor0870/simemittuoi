"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmployeeSuggestInput } from "@/components/polls/EmployeeSuggestInput";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { LIFE_EVENT_TYPES } from "@/lib/life-events/registry";
import { vndInWords } from "@/lib/print/vn-money";
import { VISIT_LIMITS, formatVnd, parseVisitInput } from "@/lib/visits/registry";

export type VisitFormValues = {
  employeeCode: string;
  memberName: string;
  memberDepartment: string;
  eventType: string;
  reason: string;
  amount: string;
  visitorName: string;
  note: string;
};

type Props = {
  mode: "create" | "edit";
  initial: VisitFormValues;
  /** Mức chi mặc định theo loại sự việc (cài đặt biểu mẫu). */
  defaultAmounts: Record<string, number>;
  requestId?: string;
  lifeEventId?: string | null;
  onCancel?: () => void;
};

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";

export function VisitRequestForm({ mode, initial, defaultAmounts, requestId, lifeEventId, onCancel }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<VisitFormValues>(initial);
  const [nameQuery, setNameQuery] = useState(initial.memberName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<VisitFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const amount = Math.round(Number(values.amount.replace(/\D/g, "")));
  const suggested = values.eventType ? defaultAmounts[values.eventType] : undefined;

  async function submit() {
    const payload = { ...values, amount, lifeEventId: lifeEventId ?? undefined };
    const parsed = parseVisitInput(payload);
    if (!parsed.ok) {
      setError(parsed.errors.join(" "));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "create" ? "/api/visits" : `/api/visits/${requestId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Không lưu được đề nghị.");
        return;
      }
      if (mode === "create") router.push(`/office/visits/${data.id}?created=1`);
      else {
        router.refresh();
        onCancel?.();
      }
    } catch {
      setError("Mất kết nối, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <div>
        <label className={labelClass}>Đoàn viên được thăm hỏi *</label>
        <EmployeeSuggestInput
          className={inputClass}
          placeholder="Gõ mã NV hoặc họ tên để chọn"
          searchUrl="/api/visits/employee-search"
          value={nameQuery}
          onChange={(text) => {
            setNameQuery(text);
            set({ employeeCode: "", memberName: "", memberDepartment: "" });
          }}
          onPick={(emp) => {
            setNameQuery(emp.fullName);
            set({ employeeCode: emp.employeeCode, memberName: emp.fullName, memberDepartment: emp.department });
          }}
        />
        {values.employeeCode ? (
          <p className="mt-1 text-xs text-[#173A67]">
            <MaterialIcon className="mr-0.5 align-[-3px] text-[14px]" name="check_circle" />
            {values.memberName} · {values.employeeCode}
            {values.memberDepartment ? ` · ${values.memberDepartment}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-xs text-amber-700">Chưa chọn đoàn viên – hãy chọn một dòng trong danh sách gợi ý.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Loại sự việc</label>
          <select
            className={inputClass}
            value={values.eventType}
            onChange={(e) => {
              const eventType = e.target.value;
              const preset = defaultAmounts[eventType];
              set({ eventType, ...(preset && !values.amount ? { amount: String(preset) } : {}) });
            }}
          >
            <option value="">— Không chọn —</option>
            {LIFE_EVENT_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Số tiền (VNĐ) *</label>
          <input
            className={inputClass}
            inputMode="numeric"
            placeholder="Ví dụ: 500.000"
            value={values.amount ? new Intl.NumberFormat("vi-VN").format(amount || 0) : ""}
            onChange={(e) => set({ amount: e.target.value.replace(/\D/g, "").slice(0, 10) })}
          />
          {amount > 0 ? <p className="mt-1 text-xs text-on-surface-variant">{vndInWords(amount)}</p> : null}
          {suggested && suggested !== amount ? (
            <button
              className="mt-1 text-xs font-semibold text-[#173A67] underline"
              type="button"
              onClick={() => set({ amount: String(suggested) })}
            >
              Dùng mức chi mặc định {formatVnd(suggested)}
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <label className={labelClass}>Lý do thăm hỏi *</label>
        <input
          className={inputClass}
          maxLength={VISIT_LIMITS.reason}
          placeholder="Ví dụ: Ốm đau / nằm viện – Bố đẻ: Nguyễn Văn A"
          value={values.reason}
          onChange={(e) => set({ reason: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Họ tên người thăm hỏi (người làm đơn) *</label>
          <input
            className={inputClass}
            maxLength={VISIT_LIMITS.name}
            value={values.visitorName}
            onChange={(e) => set({ visitorName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Ghi chú nội bộ</label>
          <input
            className={inputClass}
            maxLength={VISIT_LIMITS.note}
            placeholder="Không in lên phiếu"
            value={values.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-3 py-2 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => void submit()}
        >
          <MaterialIcon className="text-[18px]" name={busy ? "progress_activity" : "save"} />
          {mode === "create" ? "Lập đề nghị" : "Lưu thay đổi"}
        </button>
        {onCancel ? (
          <button
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:border-[#173A67]"
            disabled={busy}
            type="button"
            onClick={onCancel}
          >
            Hủy
          </button>
        ) : null}
      </div>
    </div>
  );
}
