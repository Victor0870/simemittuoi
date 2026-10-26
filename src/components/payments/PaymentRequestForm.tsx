"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PaymentMemberPicker } from "@/components/payments/PaymentMemberPicker";
import { PaymentSlipPreview } from "@/components/payments/PaymentSlipPreview";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { counterpartyMatches, type Counterparty } from "@/lib/catalogs/registry";
import { formatDateVi } from "@/lib/members/profile-shared";
import { newPaymentItem, type PaymentFormItem } from "@/lib/payments/form-items";
import {
  PAYMENT_LIMITS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_RECEIVER_KIND_LABEL,
  parsePaymentInput,
  type PaymentInput,
  type PaymentMethod,
  type PaymentReceiverKind,
} from "@/lib/payments/registry";
import type { PaymentMember, PaymentMemberBank, VisitCandidate } from "@/lib/payments/server";
import { SLIP_CODE_PENDING, mapPaymentSlip, type PaymentSlipData, type SlipSigners } from "@/lib/payments/slip-data";
import { vndInWords } from "@/lib/print/vn-money";
import { formatVnd } from "@/lib/visits/registry";

export type PaymentFormValues = {
  requestDate: string;
  requesterName: string;
  requesterDepartment: string;
  paymentMethod: PaymentMethod;
  receiverKind: PaymentReceiverKind;
  receiverMemberId: string;
  receiverName: string;
  receiverAccount: string;
  receiverBank: string;
  counterpartyId: string;
  note: string;
  items: PaymentFormItem[];
};

type Props = {
  mode: "create" | "edit";
  initial: PaymentFormValues;
  requestId?: string;
  /** Có quyền xem phiếu thăm hỏi → hiện nút gom phiếu đã duyệt. */
  canGatherVisits: boolean;
  /** Danh mục đối tượng để chọn người nhận (đang dùng + đối tượng đã gắn). */
  counterparties?: Counterparty[];
  /** Đoàn viên để chọn người nhận theo tên / mã NV (số TK lấy từ hồ sơ khi chọn). */
  members?: PaymentMember[];
  /** Bộ phận mặc định và người ký theo Cài đặt biểu mẫu in – để xem trước giấy đề nghị. */
  slipSigners: SlipSigners;
  /** Logo theo Cài đặt biểu mẫu in (null = để trống chỗ logo). */
  slipLogoUrl: string | null;
  /** Mã đề nghị đã cấp (khi sửa); lập mới thì chưa có. */
  requestCode?: string;
  onCancel?: () => void;
};

const RECEIVER_KINDS: PaymentReceiverKind[] = ["organization", "individual", "member"];

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";
const invalidInputClass = inputClass.replace("border-outline-variant", "border-error bg-error-container/20");

const toNumber = (value: string) => Number(value.replace(/\D/g, "")) || 0;
const formatInput = (value: string) => (value ? new Intl.NumberFormat("vi-VN").format(toNumber(value)) : "");

function visitLine(v: VisitCandidate): string {
  const who = v.member_department ? `${v.member_name} (${v.member_department})` : v.member_name;
  return `Thăm hỏi ${who} – ${v.reason}`.slice(0, PAYMENT_LIMITS.content);
}

export function PaymentRequestForm({
  mode,
  initial,
  requestId,
  canGatherVisits,
  counterparties,
  members,
  slipSigners,
  slipLogoUrl,
  requestCode,
  onCancel,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<PaymentFormValues>(initial);
  /** Ô lỗi sau lần kiểm tra gần nhất; dòng chi phí ghi theo item.key: `items.<key>.<trường>`. */
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PaymentSlipData | null>(null);
  const [partySearch, setPartySearch] = useState("");
  const [memberBank, setMemberBank] = useState<{ loading: boolean; missing: boolean; error: string | null }>({
    loading: false,
    missing: false,
    error: null,
  });
  const [busy, setBusy] = useState<"save" | "print" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<VisitCandidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const clearInvalid = (fields: string[]) =>
    setInvalid((prev) => {
      if (!fields.some((f) => prev.has(f))) return prev;
      const next = new Set(prev);
      for (const f of fields) next.delete(f);
      return next;
    });
  const set = (patch: Partial<PaymentFormValues>) => {
    clearInvalid(Object.keys(patch));
    setValues((v) => ({ ...v, ...patch }));
  };
  const setItem = (key: string, patch: Partial<PaymentFormItem>) => {
    clearInvalid(Object.keys(patch).map((f) => `items.${key}.${f}`));
    setValues((v) => ({ ...v, items: v.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
  };
  const field = (name: string) => (invalid.has(name) ? invalidInputClass : inputClass);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [preview]);
  const removeItem = (key: string) => setValues((v) => ({ ...v, items: v.items.filter((i) => i.key !== key) }));
  const moveItem = (index: number, delta: number) =>
    setValues((v) => {
      const items = [...v.items];
      const target = index + delta;
      if (target < 0 || target >= items.length) return v;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...v, items };
    });

  const total = values.items.reduce((sum, i) => sum + toNumber(i.amount), 0);
  const advanced = values.items.reduce((sum, i) => sum + toNumber(i.advanced), 0);
  const linkedIds = new Set(values.items.map((i) => i.visitRequestId).filter(Boolean));
  const isMember = values.receiverKind === "member";
  const party = counterparties?.find((c) => c.id === values.counterpartyId) ?? null;
  const kindParties = (counterparties ?? []).filter((c) => c.kind === values.receiverKind || c.id === values.counterpartyId);
  const partyOptions = kindParties.filter((c) => c.id === values.counterpartyId || counterpartyMatches(c, partySearch));

  function changeKind(kind: PaymentReceiverKind) {
    if (kind === values.receiverKind) return;
    setPartySearch("");
    setMemberBank({ loading: false, missing: false, error: null });
    set({ receiverKind: kind, counterpartyId: "", receiverMemberId: "", receiverName: "", receiverAccount: "", receiverBank: "" });
  }

  async function pickMember(member: PaymentMember | null) {
    if (!member) {
      setMemberBank({ loading: false, missing: false, error: null });
      set({ receiverMemberId: "" });
      return;
    }
    set({ receiverMemberId: member.id, receiverName: member.full_name.slice(0, PAYMENT_LIMITS.name) });
    setMemberBank({ loading: true, missing: false, error: null });
    try {
      const res = await fetch(`/api/payments/members/${member.id}`);
      const data = (await res.json().catch(() => ({}))) as { bank?: PaymentMemberBank; error?: string };
      if (!res.ok || !data.bank) {
        setMemberBank({ loading: false, missing: false, error: data.error ?? "Không tải được số tài khoản của đoàn viên." });
        return;
      }
      const b = data.bank;
      const bankText = [b.bank_name, b.bank_branch].filter(Boolean).join(" – ");
      setValues((v) =>
        v.receiverMemberId === member.id
          ? {
              ...v,
              receiverName: (b.bank_account_holder || member.full_name).slice(0, PAYMENT_LIMITS.name),
              receiverAccount: (b.bank_account_no ?? "").slice(0, PAYMENT_LIMITS.account),
              receiverBank: bankText.slice(0, PAYMENT_LIMITS.name),
            }
          : v,
      );
      setMemberBank({ loading: false, missing: !b.bank_account_no || !b.bank_name, error: null });
    } catch {
      setMemberBank({ loading: false, missing: false, error: "Mất kết nối, không tải được số tài khoản." });
    }
  }

  function pickCounterparty(id: string) {
    const c = counterparties?.find((x) => x.id === id);
    if (!c) {
      set({ counterpartyId: "" });
      return;
    }
    set({
      counterpartyId: c.id,
      receiverName: c.name.slice(0, PAYMENT_LIMITS.name),
      receiverAccount: c.bank_account_no ?? "",
      receiverBank: c.bank_name ?? "",
    });
  }

  async function openCandidates() {
    setLoadingCandidates(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/visit-candidates${requestId ? `?except=${requestId}` : ""}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Không tải được phiếu thăm hỏi.");
        return;
      }
      setCandidates(data.candidates ?? []);
      setPicked(new Set());
    } catch {
      setError("Mất kết nối, vui lòng thử lại.");
    } finally {
      setLoadingCandidates(false);
    }
  }

  function addPicked() {
    const chosen = (candidates ?? []).filter((c) => picked.has(c.id) && !linkedIds.has(c.id));
    if (!chosen.length) return;
    setValues((v) => {
      const kept = v.items.filter((i) => i.content.trim() || i.amount || i.visitRequestId);
      const added = chosen.map((c) =>
        newPaymentItem({
          content: visitLine(c),
          amount: String(c.amount),
          visitRequestId: c.id,
          visitCode: c.code,
        }),
      );
      return { ...v, items: [...kept, ...added] };
    });
    setCandidates(null);
    setPicked(new Set());
  }

  function buildPayload() {
    return {
      ...values,
      items: values.items.map((i) => ({
        content: i.content,
        paidTo: i.paidTo,
        amount: toNumber(i.amount),
        advanced: toNumber(i.advanced),
        visitRequestId: i.visitRequestId,
      })),
    };
  }

  /** Cùng bước kiểm tra như khi lập; lỗi thì báo và tô đỏ các ô liên quan. */
  function validate(payload: ReturnType<typeof buildPayload>): PaymentInput | null {
    const parsed = parsePaymentInput(payload);
    if (parsed.ok) {
      setInvalid(new Set());
      return parsed.value;
    }
    setError(parsed.errors.join(" "));
    setInvalid(
      new Set(
        parsed.fields.map((f) => {
          const m = /^items\.(\d+)\.(\w+)$/.exec(f);
          return m ? `items.${values.items[Number(m[1])]?.key}.${m[2]}` : f;
        }),
      ),
    );
    return null;
  }

  function openPreview() {
    const input = validate(buildPayload());
    if (!input) return;
    setError(null);
    setPreview(
      mapPaymentSlip(
        {
          code: requestCode ?? null,
          request_date: input.requestDate,
          requester_name: input.requesterName,
          requester_department: input.requesterDepartment,
          payment_method: input.paymentMethod,
          receiver_name: input.receiverName,
          receiver_account: input.receiverAccount,
          receiver_bank: input.receiverBank,
          total_amount: input.items.reduce((sum, i) => sum + i.amount, 0),
          advanced_amount: input.items.reduce((sum, i) => sum + i.advanced, 0),
        },
        input.items.map((i) => ({ content: i.content, amount: i.amount, advanced: i.advanced })),
        slipSigners,
      ),
    );
  }

  async function submit(print = false) {
    const payload = buildPayload();
    if (!validate(payload)) {
      setPreview(null);
      return;
    }
    setBusy(print ? "print" : "save");
    setError(null);
    try {
      const res = await fetch(mode === "create" ? "/api/payments" : `/api/payments/${requestId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Không lưu được đề nghị.");
        return;
      }
      if (mode === "create") router.push(`/admin/administration/payments/${data.id}?created=1${print ? "&print=1" : ""}`);
      else {
        router.refresh();
        onCancel?.();
      }
    } catch {
      setError("Mất kết nối, vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[180px_1fr_1fr]">
        <div>
          <label className={labelClass}>Ngày đề nghị *</label>
          <input
            className={field("requestDate")}
            type="date"
            value={values.requestDate}
            onChange={(e) => set({ requestDate: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Người đề nghị (Requestor) *</label>
          <input
            className={field("requesterName")}
            maxLength={PAYMENT_LIMITS.name}
            value={values.requesterName}
            onChange={(e) => set({ requesterName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Bộ phận (Department)</label>
          <input
            className={field("requesterDepartment")}
            maxLength={PAYMENT_LIMITS.name}
            value={values.requesterDepartment}
            onChange={(e) => set({ requesterDepartment: e.target.value })}
          />
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#173A67]">Chi tiết chi phí *</h2>
          {canGatherVisits ? (
            <button
              className="inline-flex items-center gap-1 rounded-xl border border-[#173A67]/40 px-3 py-1.5 text-xs font-bold text-[#173A67] hover:bg-[#173A67]/5 disabled:opacity-60"
              disabled={loadingCandidates}
              type="button"
              onClick={() => void openCandidates()}
            >
              <MaterialIcon className="text-[16px]" name={loadingCandidates ? "progress_activity" : "playlist_add"} />
              Thêm từ phiếu thăm hỏi đã duyệt
            </button>
          ) : null}
        </div>

        {candidates ? (
          <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
            {candidates.length === 0 ? (
              <p className="text-sm text-sky-900">Không có phiếu thăm hỏi nào đã duyệt mà chưa gom vào đề nghị thanh toán.</p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-xs font-bold text-sky-900">
                  <input
                    checked={candidates.every((c) => picked.has(c.id) || linkedIds.has(c.id))}
                    type="checkbox"
                    onChange={(e) =>
                      setPicked(new Set(e.target.checked ? candidates.filter((c) => !linkedIds.has(c.id)).map((c) => c.id) : []))
                    }
                  />
                  Chọn tất cả ({candidates.length} phiếu)
                </label>
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {candidates.map((c) => {
                    const already = linkedIds.has(c.id);
                    return (
                      <li key={c.id}>
                        <label
                          className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${already ? "opacity-50" : "hover:bg-white"}`}
                        >
                          <input
                            checked={already || picked.has(c.id)}
                            className="mt-1"
                            disabled={already}
                            type="checkbox"
                            onChange={(e) =>
                              setPicked((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(c.id);
                                else next.delete(c.id);
                                return next;
                              })
                            }
                          />
                          <span className="flex-1">
                            <b>{c.code}</b> · {c.member_name} – {c.reason}
                            <span className="block text-[11px] text-on-surface-variant">
                              Người thăm: {c.visitor_name}
                              {c.decided_at ? ` · duyệt ${formatDateVi(c.decided_at.slice(0, 10))}` : ""}
                              {already ? " · đã có trong đề nghị này" : ""}
                            </span>
                          </span>
                          <span className="font-bold whitespace-nowrap">{formatVnd(c.amount)}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <div className="flex gap-2">
              {candidates.length ? (
                <button
                  className="rounded-xl bg-[#173A67] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  disabled={picked.size === 0}
                  type="button"
                  onClick={addPicked}
                >
                  Thêm {picked.size} phiếu vào đề nghị
                </button>
              ) : null}
              <button
                className="rounded-xl border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant"
                type="button"
                onClick={() => setCandidates(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {values.items.map((item, index) => (
            <div key={item.key} className="rounded-xl border border-outline-variant bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-on-surface-variant">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#173A67] text-white">{index + 1}</span>
                {item.visitCode ? (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">Phiếu thăm hỏi {item.visitCode}</span>
                ) : null}
                <span className="ml-auto flex gap-1">
                  <button
                    aria-label="Lên"
                    className="rounded p-0.5 hover:bg-surface-container-high disabled:opacity-30"
                    disabled={index === 0}
                    type="button"
                    onClick={() => moveItem(index, -1)}
                  >
                    <MaterialIcon className="text-[18px]" name="arrow_upward" />
                  </button>
                  <button
                    aria-label="Xuống"
                    className="rounded p-0.5 hover:bg-surface-container-high disabled:opacity-30"
                    disabled={index === values.items.length - 1}
                    type="button"
                    onClick={() => moveItem(index, 1)}
                  >
                    <MaterialIcon className="text-[18px]" name="arrow_downward" />
                  </button>
                  <button
                    aria-label="Xóa dòng"
                    className="rounded p-0.5 text-error hover:bg-error-container/40 disabled:opacity-30"
                    disabled={values.items.length === 1}
                    type="button"
                    onClick={() => removeItem(item.key)}
                  >
                    <MaterialIcon className="text-[18px]" name="delete" />
                  </button>
                </span>
              </div>
              <input
                className={field(`items.${item.key}.content`)}
                maxLength={PAYMENT_LIMITS.content}
                placeholder="Chi tiết chi phí"
                value={item.content}
                onChange={(e) => setItem(item.key, { content: e.target.value })}
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-on-surface-variant">
                  Thực trả (VNĐ) *
                  <input
                    className={`${field(`items.${item.key}.amount`)} mt-0.5`}
                    inputMode="numeric"
                    placeholder="0"
                    value={formatInput(item.amount)}
                    onChange={(e) => setItem(item.key, { amount: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  />
                </label>
                <label className="text-xs text-on-surface-variant">
                  Đã tạm ứng (VNĐ)
                  <input
                    className={`${field(`items.${item.key}.advanced`)} mt-0.5`}
                    inputMode="numeric"
                    placeholder="0"
                    value={formatInput(item.advanced)}
                    onChange={(e) => setItem(item.key, { advanced: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-dashed border-outline-variant px-3 py-1.5 text-sm font-semibold text-[#173A67] hover:border-[#173A67] disabled:opacity-50"
            disabled={values.items.length >= PAYMENT_LIMITS.items}
            type="button"
            onClick={() => set({ items: [...values.items, newPaymentItem()] })}
          >
            <MaterialIcon className="text-[18px]" name="add" />
            Thêm dòng
          </button>
          <div className="text-right text-sm">
            <p>
              Tổng thực trả: <b className="text-[#173A67]">{formatVnd(total)}</b>
              {advanced ? (
                <>
                  {" "}
                  · Đã tạm ứng: <b>{formatVnd(advanced)}</b> · Còn chi: <b>{formatVnd(Math.max(total - advanced, 0))}</b>
                </>
              ) : null}
            </p>
            {total > 0 ? <p className="text-xs text-on-surface-variant">{vndInWords(total)}</p> : null}
          </div>
        </div>
        {values.items.length > PAYMENT_LIMITS.slipRows ? (
          <p className="text-xs text-amber-800">
            Mẫu giấy chỉ có {PAYMENT_LIMITS.slipRows} dòng: khi in sẽ ghi một dòng “chi theo bảng kê đính kèm” và thêm trang Bảng kê
            liệt kê đủ {values.items.length} khoản.
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-outline-variant bg-white p-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-bold text-on-surface-variant">Phương thức thanh toán:</span>
          {(["transfer", "cash"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm font-semibold">
              <input checked={values.paymentMethod === m} name="paymentMethod" type="radio" onChange={() => set({ paymentMethod: m })} />
              {PAYMENT_METHOD_LABEL[m]}
            </label>
          ))}
        </div>
        <div className="space-y-2 rounded-lg bg-surface-container-low p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-on-surface-variant" htmlFor="payment-receiver-kind">
              Đối tượng nhận tiền:
            </label>
            <select
              className={`${inputClass} w-auto min-w-[160px]`}
              id="payment-receiver-kind"
              value={values.receiverKind}
              onChange={(e) => changeKind(e.target.value as PaymentReceiverKind)}
            >
              {RECEIVER_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_RECEIVER_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          {isMember ? (
            members ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-on-surface-variant">
                  Nhập họ tên hoặc mã NV rồi chọn đoàn viên – số tài khoản và ngân hàng lấy từ hồ sơ đoàn viên.
                </p>
                <PaymentMemberPicker
                  inputClass={field("receiverMemberId")}
                  labelClass={labelClass}
                  memberId={values.receiverMemberId}
                  members={members}
                  onPick={(m) => void pickMember(m)}
                />
                {memberBank.loading ? (
                  <p className="text-xs text-on-surface-variant">Đang lấy số tài khoản từ hồ sơ đoàn viên…</p>
                ) : memberBank.error ? (
                  <p className="text-xs text-error">{memberBank.error}</p>
                ) : memberBank.missing ? (
                  <p className="text-xs text-amber-700">
                    Đoàn viên chưa khai đủ số tài khoản / ngân hàng trong hồ sơ – hãy nhập tay bên dưới.
                  </p>
                ) : null}
              </div>
            ) : null
          ) : counterparties ? (
          <div className="space-y-1.5">
            <label className={labelClass}>
              Chọn {PAYMENT_RECEIVER_KIND_LABEL[values.receiverKind].toLowerCase()} từ danh mục (tự điền người nhận, số TK, ngân hàng)
            </label>
            {kindParties.length ? (
              <div className="flex flex-wrap gap-2">
                {kindParties.length > 10 ? (
                  <input
                    className={`${inputClass} sm:max-w-[220px]`}
                    placeholder="Tìm mã, tên, MST..."
                    value={partySearch}
                    onChange={(e) => setPartySearch(e.target.value)}
                  />
                ) : null}
                <select
                  className={`${inputClass} min-w-[220px] flex-1`}
                  value={values.counterpartyId}
                  onChange={(e) => pickCounterparty(e.target.value)}
                >
                  <option value="">— Không chọn (nhập tay) —</option>
                  {partyOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} – {c.name}
                      {c.bank_account_no ? "" : " (chưa có TK)"}
                      {c.is_active ? "" : " (ngừng dùng)"}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">
                Danh mục chưa có {PAYMENT_RECEIVER_KIND_LABEL[values.receiverKind].toLowerCase()} nào – nhập tay bên dưới, hoặc
                thêm tại mục Quản lý danh mục để lần sau chọn nhanh.
              </p>
            )}
            {party ? (
              <p className="text-xs text-on-surface-variant">
                {[party.tax_code && `MST ${party.tax_code}`, party.address].filter(Boolean).join(" · ") || "Chưa có MST / địa chỉ"}
                {values.paymentMethod === "transfer" && !party.bank_account_no ? (
                  <span className="text-amber-700"> · Đối tượng chưa có số tài khoản, hãy nhập tay hoặc bổ sung trong danh mục.</span>
                ) : null}
              </p>
            ) : null}
          </div>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Người nhận / Chủ TK{values.paymentMethod === "transfer" ? " *" : ""}</label>
            <input
              className={field("receiverName")}
              maxLength={PAYMENT_LIMITS.name}
              value={values.receiverName}
              onChange={(e) => set({ receiverName: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Số tài khoản{values.paymentMethod === "transfer" ? " *" : ""}</label>
            <input
              className={field("receiverAccount")}
              inputMode="numeric"
              maxLength={PAYMENT_LIMITS.account}
              value={values.receiverAccount}
              onChange={(e) => set({ receiverAccount: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Ngân hàng{values.paymentMethod === "transfer" ? " *" : ""}</label>
            <input
              className={field("receiverBank")}
              maxLength={PAYMENT_LIMITS.name}
              placeholder="Ví dụ: Vietcombank – CN Hải Phòng"
              value={values.receiverBank}
              onChange={(e) => set({ receiverBank: e.target.value })}
            />
          </div>
        </div>
      </section>

      <div>
        <label className={labelClass}>Ghi chú nội bộ</label>
        <input
          className={field("note")}
          maxLength={PAYMENT_LIMITS.note}
          placeholder="Không in lên giấy đề nghị"
          value={values.note}
          onChange={(e) => set({ note: e.target.value })}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-3 py-2 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-60"
          disabled={busy !== null || memberBank.loading}
          type="button"
          onClick={() => void submit()}
        >
          <MaterialIcon className="text-[18px]" name={busy === "save" ? "progress_activity" : "save"} />
          {mode === "create" ? "Lập đề nghị" : "Lưu thay đổi"}
        </button>
        {mode === "create" ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#173A67] px-4 py-2 text-sm font-bold text-[#173A67] hover:bg-[#173A67]/5 disabled:opacity-60"
            disabled={busy !== null || memberBank.loading}
            type="button"
            onClick={() => void submit(true)}
          >
            <MaterialIcon className="text-[18px]" name={busy === "print" ? "progress_activity" : "print"} />
            Lập &amp; tải giấy đề nghị (Excel)
          </button>
        ) : null}
        <button
          className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-[#173A67] hover:border-[#173A67] disabled:opacity-60"
          disabled={busy !== null || memberBank.loading}
          type="button"
          onClick={openPreview}
        >
          <MaterialIcon className="text-[18px]" name="preview" />
          Xem trước
        </button>
        {onCancel ? (
          <button
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:border-[#173A67]"
            disabled={busy !== null}
            type="button"
            onClick={onCancel}
          >
            Hủy
          </button>
        ) : null}
      </div>
      {mode === "create" ? (
        <p className="text-[11px] text-on-surface-variant">
          Bấm “Xem trước” để xem giấy đề nghị sẽ in ra sao mà chưa lưu, chưa cấp mã số. Giấy đề nghị được cấp mã số khi lập;
          “Lập &amp; tải giấy đề nghị” lập và tải file in ngay, nút “Tải giấy đề nghị” cũng có ở trang chi tiết.
        </p>
      ) : null}

      {preview ? (
        <div
          aria-labelledby="payment-preview-title"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-6"
          role="dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreview(null);
          }}
        >
          <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden bg-surface-container-lowest shadow-xl sm:rounded-2xl">
            <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant px-4 py-3">
              <h2 className="text-title-md font-bold text-[#173A67]" id="payment-preview-title">
                Xem trước giấy đề nghị
              </h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                {requestCode ? `Số: ${requestCode}` : SLIP_CODE_PENDING}
              </span>
              <button
                aria-label="Đóng"
                className="ml-auto rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high"
                type="button"
                onClick={() => setPreview(null)}
              >
                <MaterialIcon className="text-[22px]" name="close" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-surface-container-low p-2 sm:p-4">
              <div className="space-y-1 px-1 text-xs text-on-surface-variant">
                <p>
                  Bản xem trước chưa lưu vào hệ thống. Tổng thực trả <b className="text-[#173A67]">{formatVnd(preview.totals.paid)}</b>
                  {" – "}
                  {vndInWords(preview.totals.paid)}
                </p>
                <p>
                  Mã số đề nghị {requestCode ? "" : "cấp khi lập, "}không in trên trang chính của mẫu
                  {preview.itemSheet ? "; có ở tiêu đề trang Bảng kê" : ""}.
                </p>
                {!slipSigners.accountantName || !slipSigners.chairmanName ? (
                  <p className="text-amber-800">
                    Chưa cài họ tên{" "}
                    {[!slipSigners.accountantName && "Kế toán Công đoàn", !slipSigners.chairmanName && "Chủ tịch BCH Công đoàn"]
                      .filter(Boolean)
                      .join(", ")}{" "}
                    nên ô chữ ký để trống – nhập ở Cài đặt biểu mẫu in.
                  </p>
                ) : null}
              </div>
              <PaymentSlipPreview data={preview} logoUrl={slipLogoUrl} />
            </div>
            {error ? (
              <div className="border-t border-error/30 bg-error-container/40 px-4 py-2 text-sm text-on-error-container">{error}</div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant px-4 py-3">
              <button
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:border-[#173A67]"
                type="button"
                onClick={() => setPreview(null)}
              >
                Đóng
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-60"
                disabled={busy !== null}
                type="button"
                onClick={() => void submit()}
              >
                <MaterialIcon className="text-[18px]" name={busy === "save" ? "progress_activity" : "save"} />
                {mode === "create" ? "Lập đề nghị" : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
