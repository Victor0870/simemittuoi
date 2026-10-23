"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  COUNTERPARTY_KIND_LABEL,
  COUNTERPARTY_LIMITS,
  counterpartyMatches,
  parseCounterpartyInput,
  type Counterparty,
  type CounterpartyKind,
} from "@/lib/catalogs/registry";
import { postCatalog } from "./post";

type Props = { counterparties: Counterparty[] };

type Draft = {
  id?: string;
  code: string;
  kind: CounterpartyKind;
  name: string;
  address: string;
  taxCode: string;
  bankAccountNo: string;
  bankName: string;
  isActive: boolean;
};

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";

const EMPTY: Draft = {
  code: "",
  kind: "organization",
  name: "",
  address: "",
  taxCode: "",
  bankAccountNo: "",
  bankName: "",
  isActive: true,
};

function toDraft(c: Counterparty): Draft {
  return {
    id: c.id,
    code: c.code,
    kind: c.kind,
    name: c.name,
    address: c.address ?? "",
    taxCode: c.tax_code ?? "",
    bankAccountNo: c.bank_account_no ?? "",
    bankName: c.bank_name ?? "",
    isActive: c.is_active,
  };
}

/** Danh mục đối tượng: công ty / cá nhân nhận hoặc nộp tiền, dùng khi lập đề nghị thanh toán. */
export function CounterpartyCatalog({ counterparties }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<CounterpartyKind | "all">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      counterparties.filter(
        (c) => (showInactive || c.is_active) && (kind === "all" || c.kind === kind) && counterpartyMatches(c, search),
      ),
    [counterparties, showInactive, kind, search],
  );
  const inactiveCount = counterparties.filter((c) => !c.is_active).length;

  async function save() {
    if (!draft) return;
    const parsed = parseCounterpartyInput(draft);
    if (!parsed.ok) {
      setError(parsed.errors.join(" "));
      return;
    }
    if (draft.id && !draft.code.trim()) {
      setError("Vui lòng nhập mã số đối tượng.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const err = await postCatalog({ action: "saveCounterparty", counterparty: draft });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setMessage(draft.id ? `Đã lưu ${draft.name}.` : `Đã thêm ${draft.name}.`);
    setDraft(null);
    router.refresh();
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const header = ["STT", "Mã số", "Loại", "Tên đối tượng", "Địa chỉ", "Mã số thuế", "Số tài khoản", "Ngân hàng", "Trạng thái"];
      const data = rows.map((c, i) => [
        i + 1,
        c.code,
        COUNTERPARTY_KIND_LABEL[c.kind],
        c.name,
        c.address ?? "",
        c.tax_code ?? "",
        c.bank_account_no ?? "",
        c.bank_name ?? "",
        c.is_active ? "Đang dùng" : "Ngừng dùng",
      ]);
      const sheet = XLSX.utils.aoa_to_sheet([["DANH MỤC ĐỐI TƯỢNG"], [], header, ...data]);
      for (let r = 3; r < 3 + data.length; r++) {
        for (const c of [5, 6]) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          if (cell) {
            cell.t = "s";
            cell.z = "@";
          }
        }
      }
      sheet["!cols"] = [6, 10, 16, 40, 44, 16, 20, 28, 12].map((wch) => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Doi tuong");
      XLSX.writeFile(book, "danh_muc_doi_tuong.xlsx");
    } finally {
      setExporting(false);
    }
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const form = draft ? (
    <div className="space-y-3 rounded-xl border border-[#173A67]/30 bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-[140px_1fr_200px]">
        <div>
          <label className={labelClass}>Mã số đối tượng{draft.id ? " *" : ""}</label>
          <input
            className={inputClass}
            maxLength={COUNTERPARTY_LIMITS.code}
            placeholder={draft.id ? "" : "Để trống: tự cấp"}
            value={draft.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })}
          />
        </div>
        <div>
          <label className={labelClass}>Tên đối tượng *</label>
          <input
            className={inputClass}
            maxLength={COUNTERPARTY_LIMITS.name}
            placeholder="VD: Công ty TNHH ABC"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Loại</label>
          <select className={inputClass} value={draft.kind} onChange={(e) => set({ kind: e.target.value as CounterpartyKind })}>
            {(Object.keys(COUNTERPARTY_KIND_LABEL) as CounterpartyKind[]).map((k) => (
              <option key={k} value={k}>
                {COUNTERPARTY_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div>
          <label className={labelClass}>Địa chỉ</label>
          <input
            className={inputClass}
            maxLength={COUNTERPARTY_LIMITS.address}
            value={draft.address}
            onChange={(e) => set({ address: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Mã số thuế</label>
          <input
            className={inputClass}
            inputMode="numeric"
            maxLength={COUNTERPARTY_LIMITS.taxCode}
            placeholder="10 số hoặc 10 số-3 số"
            value={draft.taxCode}
            onChange={(e) => set({ taxCode: e.target.value.replace(/[^\d-]/g, "") })}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Số tài khoản ngân hàng</label>
          <input
            className={inputClass}
            inputMode="numeric"
            maxLength={COUNTERPARTY_LIMITS.account}
            value={draft.bankAccountNo}
            onChange={(e) => set({ bankAccountNo: e.target.value.replace(/\s/g, "") })}
          />
        </div>
        <div>
          <label className={labelClass}>Ngân hàng (tên + chi nhánh)</label>
          <input
            className={inputClass}
            maxLength={COUNTERPARTY_LIMITS.bankName}
            placeholder="VD: Vietcombank – CN Hải Phòng"
            value={draft.bankName}
            onChange={(e) => set({ bankName: e.target.value })}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input checked={draft.isActive} type="checkbox" onChange={(e) => set({ isActive: e.target.checked })} />
        Đang sử dụng (bỏ chọn để ẩn khỏi ô chọn khi lập đề nghị; chứng từ cũ vẫn giữ liên kết)
      </label>
      <div className="flex gap-2">
        <button
          className="rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => void save()}
        >
          {draft.id ? "Lưu thay đổi" : "Thêm đối tượng"}
        </button>
        <button
          className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant"
          type="button"
          onClick={() => {
            setDraft(null);
            setError(null);
          }}
        >
          Đóng
        </button>
      </div>
    </div>
  ) : null;

  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-title-md font-bold text-[#173A67]">Danh mục đối tượng</h2>
          <p className="text-xs text-on-surface-variant">
            Công ty, cá nhân nhận hoặc nộp tiền. Khi lập đề nghị thanh toán, chọn đối tượng để tự điền tên, số tài khoản, ngân hàng.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-[#173A67] hover:border-[#173A67] disabled:opacity-60"
            disabled={exporting || rows.length === 0}
            type="button"
            onClick={() => void exportExcel()}
          >
            <MaterialIcon className="text-[18px]" name={exporting ? "progress_activity" : "download"} />
            Xuất Excel
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-dashed border-outline-variant px-3 py-1.5 text-sm font-semibold text-[#173A67] hover:border-[#173A67]"
            type="button"
            onClick={() => {
              setDraft({ ...EMPTY });
              setError(null);
            }}
          >
            <MaterialIcon className="text-[18px]" name="add" />
            Thêm đối tượng
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <MaterialIcon
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant/60"
            name="search"
          />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Tìm mã số, tên, MST, số tài khoản..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as CounterpartyKind | "all")}
        >
          <option value="all">Mọi loại</option>
          {(Object.keys(COUNTERPARTY_KIND_LABEL) as CounterpartyKind[]).map((k) => (
            <option key={k} value={k}>
              {COUNTERPARTY_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        {inactiveCount ? (
          <label className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
            <input checked={showInactive} type="checkbox" onChange={(e) => setShowInactive(e.target.checked)} />
            Hiện {inactiveCount} đối tượng ngừng dùng
          </label>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-3 py-2 text-sm text-on-error-container">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</div>
      ) : null}
      {draft && !draft.id ? form : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant px-4 py-6 text-center text-sm text-on-surface-variant">
          {counterparties.length === 0 ? "Chưa có đối tượng nào. Bấm “Thêm đối tượng” để bắt đầu." : "Không có đối tượng phù hợp."}
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant">
          {rows.map((c) => (
            <li key={c.id} className="py-2.5">
              {draft?.id === c.id ? (
                form
              ) : (
                <div className="flex flex-wrap items-start gap-3">
                  <MaterialIcon
                    className="mt-0.5 text-[22px] text-[#173A67]"
                    name={c.kind === "organization" ? "apartment" : "person"}
                  />
                  <div className="min-w-[220px] flex-1">
                    <p className={`font-bold ${c.is_active ? "" : "text-on-surface-variant line-through"}`}>
                      <span className="mr-1.5 rounded bg-surface-container-high px-1.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                        {c.code}
                      </span>
                      {c.name}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {[c.tax_code && `MST ${c.tax_code}`, c.address].filter(Boolean).join(" · ") || COUNTERPARTY_KIND_LABEL[c.kind]}
                    </p>
                    <p className="text-xs">
                      {c.bank_account_no ? (
                        <>
                          TK <b>{c.bank_account_no}</b> · {c.bank_name}
                        </>
                      ) : (
                        <span className="text-amber-700">Chưa có số tài khoản</span>
                      )}
                    </p>
                  </div>
                  <button
                    className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
                    type="button"
                    onClick={() => {
                      setDraft(toDraft(c));
                      setError(null);
                    }}
                  >
                    <MaterialIcon className="text-[16px]" name="edit" />
                    Sửa
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
