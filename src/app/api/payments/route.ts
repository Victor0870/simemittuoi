import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { validateCounterpartyLink } from "@/lib/catalogs/server";
import { parsePaymentInput, paymentRpcPayload } from "@/lib/payments/registry";
import { validateReceiverMember, validateVisitLinks } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";

/** Lập giấy đề nghị thanh toán. Body: PaymentInput. */
export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.paymentsCreate);
    if (guard.response) return guard.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parsePaymentInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(" ") }, { status: 400 });

    const db = createServiceClient();
    const visitIds = parsed.value.items.map((i) => i.visitRequestId).filter((v): v is string => Boolean(v));
    const linkErrors = await validateVisitLinks(db, visitIds);
    if (linkErrors.length) return NextResponse.json({ error: linkErrors.join(" ") }, { status: 409 });
    const counterpartyError = await validateCounterpartyLink(db, parsed.value.counterpartyId);
    if (counterpartyError) return NextResponse.json({ error: counterpartyError }, { status: 409 });
    const memberError = await validateReceiverMember(db, parsed.value.receiverMemberId);
    if (memberError) return NextResponse.json({ error: memberError }, { status: 409 });

    const { data, error } = await db
      .rpc(CDILV_RPC.paymentRequestSave, {
        p_request_id: null,
        p_actor_id: guard.access.userId,
        ...paymentRpcPayload(parsed.value),
        p_log_note: null,
      })
      .single<{ id: string; code: string }>();
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true, id: data.id, code: data.code });
  } catch (err: unknown) {
    console.error("[api/payments] create error:", err);
    return NextResponse.json({ error: "Không lập được đề nghị thanh toán." }, { status: 500 });
  }
}
