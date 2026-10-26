"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VisitRequestForm } from "@/components/visits/VisitRequestForm";
import { VisitStatusBadge } from "@/components/visits/VisitStatusBadge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateTimeVi } from "@/lib/data/albums";
import { TYPE_BY_CODE } from "@/lib/life-events/registry";
import { vndInWords } from "@/lib/print/vn-money";
import type { PaymentStatus } from "@/lib/payments/registry";
import { VISIT_LIMITS, VISIT_LOG_LABEL, VISIT_STATUS_LABEL, formatVnd } from "@/lib/visits/registry";
import type { VisitAbilities, VisitRequestDetail } from "@/lib/visits/server";

type Props = {
  detail: VisitRequestDetail;
  can: VisitAbilities;
  isCreator: boolean;
  defaultAmounts: Record<string, number>;
  /** Đề nghị thanh toán còn hiệu lực đang chứa phiếu này. */
  payment?: { id: string; code: string; status: PaymentStatus } | null;
  paymentLinkable?: boolean;
};

const textareaClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

export function VisitRequestDetailView({ detail, can, isCreator, defaultAmounts, payment, paymentLinkable }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  const isProposed = detail.status === "proposed";
  const canDecide = can.approve && isProposed && !payment;
  const canPay = can.pay && detail.status === "approved" && !payment;
  const canCancel =
    !payment &&
    (isProposed || detail.status === "approved") &&
    (can.approve || (can.create && isCreator && isProposed));
  const canEdit = can.create && isProposed;
  const printable = detail.status !== "rejected" && detail.status !== "cancelled";

  async function transition(to: "approved" | "rejected" | "paid" | "cancelled") {
    setBusy(to);
    setError(null);
    try {
      const res = await fetch(`/api/visits/${detail.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Thao tác không thành công.");
        return;
      }
      setNote("");
      router.refresh();
    } catch {
      setError("Mất kết nối, vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  if (editing) {
    return (
      <VisitRequestForm
        defaultAmounts={defaultAmounts}
        initial={{
          employeeCode: detail.member_employee_code,
          memberName: detail.member_name,
          memberDepartment: detail.member_department ?? "",
          eventType: detail.event_type ?? "",
          reason: detail.reason,
          amount: String(detail.amount),
          visitorName: detail.visitor_name,
          note: detail.note ?? "",
        }}
        mode="edit"
        requestId={detail.id}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <VisitStatusBadge status={detail.status} />
          {detail.event_type ? (
            <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
              {TYPE_BY_CODE[detail.event_type]?.label ?? detail.event_type}
            </span>
          ) : null}
          <span className="ml-auto text-xs font-semibold text-on-surface-variant">{detail.code}</span>
        </div>
        <h1 className="mt-2 text-headline-sm font-extrabold text-[#173A67]">Đề nghị thăm hỏi {detail.member_name}</h1>

        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-on-surface-variant">Đoàn viên được thăm hỏi</dt>
            <dd className="font-semibold">
              {detail.member_name}
              <span className="font-normal text-on-surface-variant">
                {` · ${detail.member_employee_code}`}
                {detail.member_department ? ` · ${detail.member_department}` : ""}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">Người thăm hỏi (người làm đơn)</dt>
            <dd className="font-semibold">{detail.visitor_name}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-on-surface-variant">Lý do thăm hỏi</dt>
            <dd className="font-semibold">{detail.reason}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-on-surface-variant">Số tiền</dt>
            <dd>
              <span className="text-lg font-extrabold text-[#173A67]">{formatVnd(detail.amount)}</span>
              <span className="ml-2 text-on-surface-variant">({vndInWords(detail.amount)})</span>
            </dd>
          </div>
          {detail.life_event_id ? (
            <div>
              <dt className="text-xs text-on-surface-variant">Tin báo gốc</dt>
              <dd>
                <Link className="font-semibold text-[#173A67] underline" href={`/life-events/${detail.life_event_id}`}>
                  {detail.life_event_code ?? "Xem tin báo"}
                </Link>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-on-surface-variant">Người lập</dt>
            <dd>
              {detail.creator_name ?? "—"} · {formatDateTimeVi(detail.created_at)}
            </dd>
          </div>
          {detail.note ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-on-surface-variant">Ghi chú nội bộ</dt>
              <dd className="whitespace-pre-line">{detail.note}</dd>
            </div>
          ) : null}
        </dl>

        {detail.decided_at ? (
          <div
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              detail.status === "rejected" ? "bg-rose-50 text-rose-800" : "bg-sky-50 text-sky-900"
            }`}
          >
            <p className="font-bold">
              {detail.status === "rejected" ? "Từ chối" : "Đã duyệt"}
              {detail.decider_name ? ` bởi ${detail.decider_name}` : ""} lúc {formatDateTimeVi(detail.decided_at)}
            </p>
            {detail.decision_note ? <p className="mt-1 whitespace-pre-line">{detail.decision_note}</p> : null}
          </div>
        ) : null}
        {payment ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <MaterialIcon className="text-[18px]" name="request_quote" />
            <span>
              Đã gom vào đề nghị thanh toán{" "}
              {paymentLinkable ? (
                <Link className="font-bold underline" href={`/admin/administration/payments/${payment.id}`}>
                  {payment.code}
                </Link>
              ) : (
                <b>{payment.code}</b>
              )}{" "}
              ({VISIT_STATUS_LABEL[payment.status]}) – việc chi tiền xử lý ở đề nghị đó.
            </span>
          </div>
        ) : null}
        {detail.paid_at ? (
          <div className="mt-2 rounded-xl bg-[#D9F2EC]/70 px-4 py-3 text-sm font-bold text-[#173A67]">
            <MaterialIcon className="mr-1 align-[-4px] text-[18px]" name="paid" />
            Đã chi{detail.payer_name ? ` – ${detail.payer_name}` : ""} lúc {formatDateTimeVi(detail.paid_at)}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {printable ? (
            <a
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E4A7D]"
              href={`/api/visits/${detail.id}/print`}
            >
              <MaterialIcon className="text-[18px]" name="download" />
              Tải phiếu thăm hỏi (Excel)
            </a>
          ) : null}
          {canEdit ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-[#173A67] hover:border-[#173A67]"
              type="button"
              onClick={() => setEditing(true)}
            >
              <MaterialIcon className="text-[18px]" name="edit" />
              Sửa đề nghị
            </button>
          ) : null}
        </div>
        {printable ? (
          <p className="mt-2 text-[11px] text-on-surface-variant">
            Phiếu điền sẵn theo mẫu C11-TLĐ; mở bằng Excel và in khổ A4. Người ký lấy theo Cài đặt biểu mẫu in.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      {canDecide || canPay || canCancel ? (
        <section className="space-y-2 rounded-2xl border-2 border-[#173A67]/20 bg-white p-4 sm:p-5">
          <h2 className="text-title-md font-bold text-[#173A67]">Xử lý đề nghị</h2>
          <textarea
            className={`${textareaClass} min-h-[60px]`}
            maxLength={VISIT_LIMITS.note}
            placeholder={canDecide ? "Ý kiến duyệt / lý do từ chối (bắt buộc khi từ chối)" : "Ghi chú (không bắt buộc)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {canDecide ? (
              <>
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-60"
                  disabled={busy !== null}
                  type="button"
                  onClick={() => void transition("approved")}
                >
                  <MaterialIcon className="text-[18px]" name={busy === "approved" ? "progress_activity" : "task_alt"} />
                  Duyệt
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  disabled={busy !== null}
                  type="button"
                  onClick={() => void transition("rejected")}
                >
                  <MaterialIcon className="text-[18px]" name="block" />
                  Từ chối
                </button>
              </>
            ) : null}
            {canPay ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                disabled={busy !== null}
                type="button"
                onClick={() => {
                  if (confirm(`Xác nhận đã chi ${formatVnd(detail.amount)} cho ${detail.member_name}?`)) void transition("paid");
                }}
              >
                <MaterialIcon className="text-[18px]" name={busy === "paid" ? "progress_activity" : "paid"} />
                Xác nhận đã chi
              </button>
            ) : null}
            {canCancel ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:border-error hover:text-error disabled:opacity-60"
                disabled={busy !== null}
                type="button"
                onClick={() => {
                  if (confirm("Hủy đề nghị thăm hỏi này?")) void transition("cancelled");
                }}
              >
                <MaterialIcon className="text-[18px]" name="cancel" />
                Hủy đề nghị
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <h2 className="mb-3 text-title-sm font-bold text-[#173A67]">Lịch sử</h2>
        <ol className="space-y-3 border-l-2 border-outline-variant pl-4">
          {detail.logs.map((l) => (
            <li key={l.id} className="relative">
              <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-[#173A67]" />
              <p className="text-sm">
                <b>{VISIT_LOG_LABEL[l.action] ?? l.action}</b>
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
