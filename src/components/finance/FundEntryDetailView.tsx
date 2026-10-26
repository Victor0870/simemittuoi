"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FundEntryForm } from "@/components/finance/FundEntryForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateTimeVi } from "@/lib/data/albums";
import { ENTRY_KIND_LABEL, ENTRY_LOG_LABEL, FINANCE_LIMITS, type Fund, type FundCategory } from "@/lib/finance/registry";
import type { FundEntryDetail } from "@/lib/finance/server";
import { formatDateVi } from "@/lib/members/profile-shared";
import { vndInWords } from "@/lib/print/vn-money";
import { formatVnd } from "@/lib/visits/registry";

type Props = {
  detail: FundEntryDetail;
  funds: Fund[];
  categories: FundCategory[];
  lockedThrough: string | null;
  canRecord: boolean;
  canViewPayments: boolean;
};

const KIND_TONE = {
  income: "bg-emerald-100 text-emerald-800",
  expense: "bg-rose-100 text-rose-800",
  transfer: "bg-sky-100 text-sky-800",
} as const;

export function FundEntryDetailView({ detail, funds, categories, lockedThrough, canRecord, canViewPayments }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fund = funds.find((f) => f.id === detail.fund_id);
  const toFund = funds.find((f) => f.id === detail.to_fund_id);
  const category = categories.find((c) => c.id === detail.category_id);
  const isLocked = Boolean(lockedThrough && detail.entry_date <= lockedThrough);
  const editable = canRecord && detail.status === "posted" && !isLocked;

  async function voidEntry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/entries/${detail.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Không hủy được bút toán.");
        return;
      }
      setVoiding(false);
      setReason("");
      router.refresh();
    } catch {
      setError("Mất kết nối, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <FundEntryForm
        categories={categories}
        entryId={detail.id}
        funds={funds}
        initial={{
          kind: detail.kind,
          entryDate: detail.entry_date,
          fundId: detail.fund_id,
          toFundId: detail.to_fund_id ?? "",
          categoryId: detail.category_id ?? "",
          amount: String(detail.amount),
          description: detail.description,
          counterparty: detail.counterparty ?? "",
          documentNo: detail.document_no ?? "",
        }}
        lockedThrough={lockedThrough}
        mode="edit"
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${KIND_TONE[detail.kind]}`}>
            {ENTRY_KIND_LABEL[detail.kind]}
          </span>
          {detail.status === "void" ? (
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">Đã hủy</span>
          ) : null}
          {isLocked ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
              <MaterialIcon className="text-[14px]" name="lock" />
              Kỳ đã khóa sổ
            </span>
          ) : null}
          <span className="ml-auto text-xs font-semibold text-on-surface-variant">{detail.code}</span>
        </div>
        <h1 className={`mt-2 text-headline-sm font-extrabold text-[#173A67] ${detail.status === "void" ? "line-through" : ""}`}>
          {detail.description}
        </h1>

        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs text-on-surface-variant">Số tiền</dt>
            <dd>
              <span className="text-lg font-extrabold text-[#173A67]">{formatVnd(detail.amount)}</span>
              <span className="ml-2 text-on-surface-variant">({vndInWords(detail.amount)})</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">Ngày ghi sổ</dt>
            <dd className="font-semibold">{formatDateVi(detail.entry_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">{detail.kind === "transfer" ? "Chuyển" : "Quỹ"}</dt>
            <dd className="font-semibold">
              {fund?.name ?? "?"}
              {detail.kind === "transfer" ? ` → ${toFund?.name ?? "?"}` : ""}
            </dd>
          </div>
          {category ? (
            <div>
              <dt className="text-xs text-on-surface-variant">Danh mục</dt>
              <dd className="font-semibold">
                {category.code ? `${category.code} – ` : ""}
                {category.name}
              </dd>
            </div>
          ) : null}
          {detail.counterparty ? (
            <div>
              <dt className="text-xs text-on-surface-variant">{detail.kind === "income" ? "Người nộp" : "Người nhận"}</dt>
              <dd className="font-semibold">{detail.counterparty}</dd>
            </div>
          ) : null}
          {detail.document_no ? (
            <div>
              <dt className="text-xs text-on-surface-variant">Chứng từ gốc</dt>
              <dd className="font-semibold">{detail.document_no}</dd>
            </div>
          ) : null}
          {detail.payment_request_id ? (
            <div>
              <dt className="text-xs text-on-surface-variant">Ghi tự động từ</dt>
              <dd>
                {canViewPayments ? (
                  <Link className="font-semibold text-[#173A67] underline" href={`/admin/administration/payments/${detail.payment_request_id}`}>
                    Đề nghị thanh toán {detail.payment_code ?? ""}
                  </Link>
                ) : (
                  <span className="font-semibold">Đề nghị thanh toán {detail.payment_code ?? ""}</span>
                )}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-on-surface-variant">Người ghi sổ</dt>
            <dd>
              {detail.creator_name ?? "—"} · {formatDateTimeVi(detail.created_at)}
            </dd>
          </div>
        </dl>

        {detail.status === "void" ? (
          <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-800">
            <p className="font-bold">
              Đã hủy{detail.voider_name ? ` bởi ${detail.voider_name}` : ""}
              {detail.voided_at ? ` lúc ${formatDateTimeVi(detail.voided_at)}` : ""}
            </p>
            {detail.void_reason ? <p className="mt-1 whitespace-pre-line">{detail.void_reason}</p> : null}
          </div>
        ) : null}

        {editable ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-[#173A67] hover:border-[#173A67]"
              type="button"
              onClick={() => setEditing(true)}
            >
              <MaterialIcon className="text-[18px]" name="edit" />
              Sửa bút toán
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:border-error hover:text-error"
              type="button"
              onClick={() => setVoiding((v) => !v)}
            >
              <MaterialIcon className="text-[18px]" name="block" />
              Hủy bút toán
            </button>
          </div>
        ) : null}

        {voiding ? (
          <div className="mt-3 space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
            <p className="text-sm text-rose-900">
              Bút toán bị hủy vẫn giữ số phiếu {detail.code} trong sổ (gạch ngang) và không tính vào số dư.
            </p>
            <textarea
              className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]"
              maxLength={FINANCE_LIMITS.reason}
              placeholder="Lý do hủy (bắt buộc)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60"
              disabled={busy || !reason.trim()}
              type="button"
              onClick={() => void voidEntry()}
            >
              <MaterialIcon className="text-[18px]" name={busy ? "progress_activity" : "block"} />
              Xác nhận hủy
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <h2 className="mb-3 text-title-sm font-bold text-[#173A67]">Lịch sử</h2>
        <ol className="space-y-3 border-l-2 border-outline-variant pl-4">
          {detail.logs.map((l) => (
            <li key={l.id} className="relative">
              <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-[#173A67]" />
              <p className="text-sm">
                <b>{ENTRY_LOG_LABEL[l.action] ?? l.action}</b>
                {l.actor_name ? <span className="text-on-surface-variant"> · {l.actor_name}</span> : null}
              </p>
              {l.note ? <p className="text-sm whitespace-pre-line text-on-surface-variant">{l.note}</p> : null}
              <p className="text-[11px] text-on-surface-variant">{formatDateTimeVi(l.created_at)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
