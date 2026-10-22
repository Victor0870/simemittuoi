"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { FORM_TEXT_LIMIT, VISIT_AMOUNT_TYPES, type FormSettings } from "@/lib/forms/settings";
import { vndInWords } from "@/lib/print/vn-money";

type Props = { initial: FormSettings };

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";

const TEXT_FIELDS: { key: keyof Omit<FormSettings, "visitAmounts">; label: string; hint?: string }[] = [
  { key: "unionName", label: "Tên đơn vị (dòng đầu phiếu)" },
  { key: "chairmanTitle", label: "Chức danh người duyệt", hint: "Ví dụ: Chủ tịch Công đoàn" },
  { key: "chairmanName", label: "Họ tên Chủ tịch Công đoàn" },
  { key: "accountantName", label: "Họ tên Kế toán Công đoàn", hint: "Ký trên Giấy đề nghị thanh toán" },
  { key: "preparerName", label: "Người lập / người thăm hỏi mặc định", hint: "Để trống = lấy tên người lập phiếu" },
  { key: "preparerDepartment", label: "Bộ phận người lập", hint: "Dòng “Bộ phận / Department” trên Giấy đề nghị thanh toán" },
];

export function PrintSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<FormSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/forms/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Không lưu được cài đặt." });
        return;
      }
      setValues(data.settings);
      setMessage({ ok: true, text: "Đã lưu cài đặt." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Mất kết nối, vui lòng thử lại." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <h2 className="text-title-md font-bold text-[#173A67]">Thông tin in trên phiếu</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className={f.key === "unionName" ? "sm:col-span-2" : ""}>
              <label className={labelClass}>{f.label}</label>
              <input
                className={inputClass}
                maxLength={FORM_TEXT_LIMIT}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
              {f.hint ? <p className="mt-0.5 text-[11px] text-on-surface-variant">{f.hint}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <div>
          <h2 className="text-title-md font-bold text-[#173A67]">Mức chi thăm hỏi mặc định</h2>
          <p className="text-xs text-on-surface-variant">
            Tự điền khi lập đề nghị theo loại sự việc; người lập vẫn sửa được số tiền từng phiếu. Để trống = không gợi ý.
          </p>
        </div>
        <div className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-white">
          {VISIT_AMOUNT_TYPES.map((t) => {
            const amount = values.visitAmounts[t.code] ?? 0;
            return (
              <div key={t.code} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="min-w-[180px] flex-1 text-sm font-semibold">{t.label}</span>
                <div className="w-44">
                  <input
                    className={`${inputClass} text-right`}
                    inputMode="numeric"
                    placeholder="—"
                    value={amount ? new Intl.NumberFormat("vi-VN").format(amount) : ""}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, "").slice(0, 10)) || 0;
                      setValues((v) => ({ ...v, visitAmounts: { ...v.visitAmounts, [t.code]: n } }));
                    }}
                  />
                </div>
                <span className="w-full text-[11px] text-on-surface-variant sm:w-auto sm:min-w-[220px]">
                  {amount ? vndInWords(amount) : ""}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {message ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            message.ok ? "bg-emerald-50 text-emerald-800" : "bg-error-container/40 text-on-error-container"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <button
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-5 py-2 text-sm font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-60"
        disabled={busy}
        type="button"
        onClick={() => void save()}
      >
        <MaterialIcon className="text-[18px]" name={busy ? "progress_activity" : "save"} />
        Lưu cài đặt
      </button>
    </div>
  );
}
