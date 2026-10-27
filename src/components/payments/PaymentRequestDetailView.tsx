"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PaymentRequestForm } from "@/components/payments/PaymentRequestForm";
import { newPaymentItem } from "@/lib/payments/form-items";
import { VisitStatusBadge } from "@/components/visits/VisitStatusBadge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { Counterparty } from "@/lib/catalogs/registry";
import type { FundCategory } from "@/lib/finance/registry";
import { formatDateTimeVi } from "@/lib/data/albums";
import { formatDateVi } from "@/lib/members/profile-shared";
import {
  PAYMENT_LIMITS,
  PAYMENT_LOG_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_RECEIVER_KIND_LABEL,
} from "@/lib/payments/registry";
import type { PaymentAbilities, PaymentMember, PaymentRequestDetail } from "@/lib/payments/server";
import { SLIP_REWARD_RECEIVER, type SlipSigners } from "@/lib/payments/slip-data";
import { vndInWords } from "@/lib/print/vn-money";
import { formatVnd } from "@/lib/visits/registry";

type Props = {
  detail: PaymentRequestDetail;
  can: PaymentAbilities;
  isCreator: boolean;
  canViewVisits: boolean;
  /** Có quyền Thanh toán thưởng – mở được danh sách thưởng đi kèm, thêm danh sách khi sửa. */
  canViewRewards: boolean;
  counterparties: Counterparty[];
  members: PaymentMember[];
  slipSigners: SlipSigners;
  slipLogoUrl: string | null;
  /** Danh mục chi (kể cả đã ẩn – để hiện tên danh mục đã chọn); chỉ danh mục đang dùng được chọn khi duyệt. */
  expenseCategories: FundCategory[];
  /** Vừa bấm “Lập & tải giấy đề nghị” – tự tải file in một lần. */
  autoPrint?: boolean;
};

const textareaClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

export function PaymentRequestDetailView({
  detail,
  can,
  isCreator,
  canViewVisits,
  canViewRewards,
  counterparties,
  members,
  slipSigners,
  slipLogoUrl,
  expenseCategories,
  autoPrint,
}: Props) {
  const router = useRouter();
  const printedRef = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  const isProposed = detail.status === "proposed";
  const canDecide = can.approve && isProposed;
  const canPay = can.pay && detail.status === "approved";
  const canCancel =
    (isProposed || detail.status === "approved") && (can.approve || (can.create && isCreator && isProposed));
  const canEdit = can.create && isProposed;
  const printable = detail.status !== "rejected" && detail.status !== "cancelled";
  const linkedVisits = detail.items.filter((i) => i.visit_request_id).length;
  const remaining = detail.total_amount - detail.advanced_amount;
  const hasRewardList = detail.items.some((i) => i.reward_poll_id);
  const receiverKind = hasRewardList ? null : (detail.receiver_kind ?? detail.counterparty?.kind ?? null);
  const category = expenseCategories.find((c) => c.id === detail.fund_category_id) ?? null;
  const categoryOptions = expenseCategories.filter((c) => c.is_active);
  const allVisits = detail.items.length > 0 && detail.items.every((i) => i.visit_request_id);
  const [categoryId, setCategoryId] = useState(
    () =>
      (category?.is_active ? category.id : null) ??
      (allVisits ? categoryOptions.find((c) => c.system_key === "visit")?.id : null) ??
      "",
  );
  const [categoryMissing, setCategoryMissing] = useState(false);

  useEffect(() => {
    if (!autoPrint || !printable || printedRef.current) return;
    printedRef.current = true;
    window.location.assign(`/api/payments/${detail.id}/print`);
    window.history.replaceState(null, "", `/admin/administration/payments/${detail.id}?created=1`);
  }, [autoPrint, printable, detail.id]);

  async function transition(to: "approved" | "rejected" | "paid" | "cancelled") {
    if (to === "approved" && !categoryId) {
      setCategoryMissing(true);
      setError("Vui lòng chọn danh mục chi trước khi duyệt.");
      return;
    }
    setBusy(to);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${detail.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(to === "approved" ? { to, note, categoryId } : { to, note }),
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
      <PaymentRequestForm
        canGatherRewards={canViewRewards}
        canGatherVisits={canViewVisits}
        initial={{
          requestDate: detail.request_date,
          requesterName: detail.requester_name,
          requesterDepartment: detail.requester_department ?? "",
          paymentMethod: detail.payment_method,
          receiverKind: receiverKind ?? "organization",
          receiverMemberId: detail.receiver_member_id ?? "",
          receiverName: detail.receiver_name ?? "",
          receiverAccount: detail.receiver_account ?? "",
          receiverBank: detail.receiver_bank ?? "",
          counterpartyId: detail.counterparty_id ?? "",
          note: detail.note ?? "",
          items: detail.items.map((i) =>
            newPaymentItem({
              content: i.content,
              paidTo: i.paid_to ?? "",
              amount: String(i.amount),
              advanced: i.advanced ? String(i.advanced) : "",
              visitRequestId: i.visit_request_id,
              visitCode: i.visit_code,
              rewardPollId: i.reward_poll_id,
              rewardTitle: i.reward_poll_title,
            }),
          ),
        }}
        counterparties={counterparties}
        members={members}
        mode="edit"
        requestCode={detail.code}
        requestId={detail.id}
        slipLogoUrl={slipLogoUrl}
        slipSigners={slipSigners}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <VisitStatusBadge status={detail.status} />
          <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
            {PAYMENT_METHOD_LABEL[detail.payment_method]}
          </span>
          <span className="ml-auto text-xs font-semibold text-on-surface-variant">{detail.code}</span>
        </div>
        <h1 className="mt-2 text-headline-sm font-extrabold break-words text-[#173A67]">{detail.title}</h1>

        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-on-surface-variant">Người đề nghị</dt>
            <dd className="font-semibold">
              {detail.requester_name}
              {detail.requester_department ? (
                <span className="font-normal text-on-surface-variant"> · {detail.requester_department}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">Ngày đề nghị</dt>
            <dd className="font-semibold">{formatDateVi(detail.request_date)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-on-surface-variant">
              {hasRewardList
                ? "Đối tượng nhận"
                : `Người nhận${receiverKind ? ` (${PAYMENT_RECEIVER_KIND_LABEL[receiverKind]})` : ""}`}
            </dt>
            <dd className="font-semibold">
              {hasRewardList ? SLIP_REWARD_RECEIVER : (detail.receiver_name ?? "—")}
              {!hasRewardList && detail.receiver_account ? (
                <span className="font-normal text-on-surface-variant">
                  {" "}
                  · TK {detail.receiver_account}
                  {detail.receiver_bank ? ` · ${detail.receiver_bank}` : ""}
                </span>
              ) : null}
              {!hasRewardList && detail.counterparty ? (
                <span className="mt-0.5 block text-xs font-normal text-on-surface-variant">
                  Đối tượng {detail.counterparty.code} – {detail.counterparty.name}
                  {detail.counterparty.tax_code ? ` · MST ${detail.counterparty.tax_code}` : ""}
                  {detail.counterparty.address ? ` · ${detail.counterparty.address}` : ""}
                </span>
              ) : null}
              {!hasRewardList && detail.receiver_member ? (
                <span className="mt-0.5 block text-xs font-normal text-on-surface-variant">
                  Đoàn viên {[detail.receiver_member.employee_code, detail.receiver_member.full_name].filter(Boolean).join(" – ")}
                  {detail.receiver_member.department ? ` · ${detail.receiver_member.department}` : ""}
                </span>
              ) : null}
            </dd>
          </div>
          {category || detail.status === "approved" || detail.status === "paid" ? (
            <div>
              <dt className="text-xs text-on-surface-variant">Danh mục chi</dt>
              <dd className="font-semibold">
                {category ? (
                  category.name
                ) : (
                  <span className="font-normal text-on-surface-variant">Chưa chọn – ghi sổ theo danh mục mặc định</span>
                )}
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

        <div className="mt-4 overflow-x-auto rounded-xl border border-outline-variant">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#D9F2EC] text-[#173A67]">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-bold [&>th]:whitespace-nowrap">
                <th>#</th>
                <th>Chi tiết chi phí</th>
                <th className="text-right">Thực trả</th>
                <th className="text-right">Đã tạm ứng</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((i) => (
                <tr key={i.id} className="border-t border-outline-variant [&>td]:px-3 [&>td]:py-2">
                  <td className="text-on-surface-variant">{i.order_num}</td>
                  <td>
                    {i.content}
                    {i.visit_request_id ? (
                      canViewVisits ? (
                        <Link
                          prefetch={false}
                          className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800 hover:underline"
                          href={`/admin/administration/visits/${i.visit_request_id}`}
                        >
                          {i.visit_code ?? "Phiếu thăm hỏi"}
                        </Link>
                      ) : (
                        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                          {i.visit_code ?? "Phiếu thăm hỏi"}
                        </span>
                      )
                    ) : null}
                    {i.reward_poll_id ? (
                      canViewRewards ? (
                        <Link
                          prefetch={false}
                          className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 hover:underline"
                          href={`/admin/administration/rewards/${i.reward_poll_id}`}
                        >
                          Xem danh sách thưởng
                        </Link>
                      ) : (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                          Danh sách thưởng
                        </span>
                      )
                    ) : null}
                  </td>
                  <td className="text-right font-semibold whitespace-nowrap">{formatVnd(i.amount)}</td>
                  <td className="text-right whitespace-nowrap">{i.advanced ? formatVnd(i.advanced) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#173A67]/20 font-bold text-[#173A67] [&>td]:px-3 [&>td]:py-2">
                <td colSpan={2}>Tổng cộng</td>
                <td className="text-right whitespace-nowrap">{formatVnd(detail.total_amount)}</td>
                <td className="text-right whitespace-nowrap">
                  {detail.advanced_amount ? formatVnd(detail.advanced_amount) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-sm">
          {detail.advanced_amount ? (
            <>
              Còn phải chi: <b className="text-[#173A67]">{formatVnd(Math.max(remaining, 0))}</b>
              {remaining < 0 ? <span className="text-rose-700"> · Trả lại công ty: {formatVnd(-remaining)}</span> : null}
              {" · "}
            </>
          ) : null}
          <span className="text-on-surface-variant">Bằng chữ: {vndInWords(detail.total_amount)}</span>
        </p>

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
              href={`/api/payments/${detail.id}/print`}
            >
              <MaterialIcon className="text-[18px]" name="download" />
              Tải giấy đề nghị (Excel)
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
            Điền sẵn theo mẫu Giấy đề nghị thanh toán của công ty; mở bằng Excel và in khổ A4.
            {detail.items.length > PAYMENT_LIMITS.slipRows ? " Có kèm trang Bảng kê vì đề nghị nhiều hơn 5 dòng." : ""} Người
            ký lấy theo Cài đặt biểu mẫu in.
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
            maxLength={PAYMENT_LIMITS.note}
            placeholder={canDecide ? "Ý kiến duyệt / lý do từ chối (bắt buộc khi từ chối)" : "Ghi chú (không bắt buộc)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {canDecide ? (
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant" htmlFor="payment-category">
                Danh mục chi * (dùng khi ghi sổ quỹ lúc xác nhận đã chi)
              </label>
              <select
                className={
                  categoryMissing
                    ? textareaClass.replace("border-outline-variant bg-white", "border-error bg-error-container/20")
                    : textareaClass
                }
                id="payment-category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setCategoryMissing(false);
                }}
              >
                <option value="">— Chọn danh mục chi —</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} – ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
                  const extra = linkedVisits ? ` ${linkedVisits} phiếu thăm hỏi kèm theo cũng chuyển sang “Đã chi”.` : "";
                  if (confirm(`Xác nhận đã chi ${formatVnd(detail.total_amount)} theo đề nghị ${detail.code}?${extra}`)) {
                    void transition("paid");
                  }
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
                  if (confirm("Hủy đề nghị thanh toán này? Các phiếu thăm hỏi kèm theo sẽ được gom lại được.")) {
                    void transition("cancelled");
                  }
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
                <b>{PAYMENT_LOG_LABEL[l.action] ?? l.action}</b>
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
