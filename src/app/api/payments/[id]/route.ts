import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadCounterparty, validateCounterpartyLink } from "@/lib/catalogs/server";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_RECEIVER_KIND_LABEL,
  parsePaymentInput,
  paymentRpcPayload,
} from "@/lib/payments/registry";
import {
  loadPaymentItems,
  loadPaymentMember,
  loadPaymentRequestRow,
  validateReceiverMember,
  validateVisitLinks,
} from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";
import { formatVnd } from "@/lib/visits/registry";

type Params = { params: Promise<{ id: string }> };

/** Sửa đề nghị khi còn chờ duyệt (ghi lại thông tin chung + toàn bộ dòng chi). */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requirePermission(PERMISSIONS.paymentsCreate);
    if (guard.response) return guard.response;

    const db = createServiceClient();
    const current = await loadPaymentRequestRow(db, id);
    if (!current) return NextResponse.json({ error: "Không tìm thấy đề nghị thanh toán." }, { status: 404 });
    if (current.status !== "proposed") {
      return NextResponse.json({ error: "Chỉ sửa được đề nghị đang chờ duyệt." }, { status: 409 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parsePaymentInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(" ") }, { status: 400 });
    const v = parsed.value;

    const currentItems = await loadPaymentItems(db, id);
    const keepIds = currentItems.map((i) => i.visit_request_id).filter((x): x is string => Boolean(x));
    const visitIds = v.items.map((i) => i.visitRequestId).filter((x): x is string => Boolean(x));
    const linkErrors = await validateVisitLinks(db, visitIds, { exceptId: id, keepIds });
    if (linkErrors.length) return NextResponse.json({ error: linkErrors.join(" ") }, { status: 409 });
    const counterpartyError = await validateCounterpartyLink(db, v.counterpartyId, current.counterparty_id);
    if (counterpartyError) return NextResponse.json({ error: counterpartyError }, { status: 409 });
    const memberError = await validateReceiverMember(db, v.receiverMemberId, current.receiver_member_id);
    if (memberError) return NextResponse.json({ error: memberError }, { status: 409 });

    const total = v.items.reduce((sum, i) => sum + i.amount, 0);
    const changes: string[] = [];
    if (v.title !== current.title) changes.push(`Nội dung: ${v.title}`);
    if (v.requestDate !== current.request_date) changes.push(`Ngày: ${v.requestDate}`);
    if (v.requesterName !== current.requester_name) changes.push(`Người đề nghị: ${v.requesterName}`);
    if (v.paymentMethod !== current.payment_method) changes.push(`Hình thức: ${PAYMENT_METHOD_LABEL[v.paymentMethod]}`);
    if (
      v.receiverName !== current.receiver_name ||
      v.receiverAccount !== current.receiver_account ||
      v.receiverBank !== current.receiver_bank
    ) {
      changes.push("Thông tin người nhận");
    }
    if (v.counterpartyId !== (current.counterparty_id ?? null)) {
      const linked = v.counterpartyId ? await loadCounterparty(db, v.counterpartyId) : null;
      changes.push(linked ? `Đối tượng: ${linked.code} – ${linked.name}` : "Bỏ gắn đối tượng");
    }
    if (current.receiver_kind && v.receiverKind !== current.receiver_kind) changes.push(`Loại đối tượng: ${PAYMENT_RECEIVER_KIND_LABEL[v.receiverKind]}`);
    if (v.receiverMemberId !== (current.receiver_member_id ?? null)) {
      const member = v.receiverMemberId ? await loadPaymentMember(db, v.receiverMemberId) : null;
      changes.push(
        member ? `Đoàn viên nhận: ${[member.employee_code, member.full_name].filter(Boolean).join(" – ")}` : "Bỏ chọn đoàn viên",
      );
    }
    if (total !== current.total_amount) changes.push(`Tổng tiền: ${formatVnd(current.total_amount)} → ${formatVnd(total)}`);
    const sameItems =
      currentItems.length === v.items.length &&
      currentItems.every((old, i) => {
        const next = v.items[i];
        return (
          old.content === next.content &&
          (old.paid_to ?? null) === next.paidTo &&
          old.amount === next.amount &&
          old.advanced === next.advanced &&
          (old.visit_request_id ?? null) === next.visitRequestId
        );
      });
    if (!sameItems) changes.push(`Dòng chi phí (${v.items.length} dòng)`);
    if ((v.note ?? null) !== (current.note ?? null)) changes.push("Ghi chú");
    if ((v.requesterDepartment ?? null) !== (current.requester_department ?? null)) changes.push("Bộ phận");
    if (!changes.length) return NextResponse.json({ success: true });

    const { error } = await db.rpc(CDILV_RPC.paymentRequestSave, {
      p_request_id: id,
      p_actor_id: guard.access.userId,
      ...paymentRpcPayload(v),
      p_log_note: changes.join("; ").slice(0, 1000),
    });
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/payments/[id]] update error:", err);
    return NextResponse.json({ error: "Không sửa được đề nghị thanh toán." }, { status: 500 });
  }
}
