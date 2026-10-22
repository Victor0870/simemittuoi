import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { buildPaymentSlip } from "@/lib/payments/print";
import { loadPaymentItems, loadPaymentRequestRow } from "@/lib/payments/server";
import { XLSX_MIME, renderTemplate } from "@/lib/print/xlsx-template";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Tải Giấy đề nghị thanh toán (mẫu công ty) đã điền sẵn, kèm trang Bảng kê nếu nhiều dòng. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requirePermission(PERMISSIONS.paymentsView);
    if (guard.response) return guard.response;

    const db = createServiceClient();
    const req = await loadPaymentRequestRow(db, id);
    if (!req) return NextResponse.json({ error: "Không tìm thấy đề nghị thanh toán." }, { status: 404 });
    if (req.status === "rejected" || req.status === "cancelled") {
      return NextResponse.json({ error: "Đề nghị đã bị từ chối hoặc đã hủy, không in được." }, { status: 409 });
    }

    const [items, settings] = await Promise.all([loadPaymentItems(db, id), loadFormSettings(db)]);
    const slip = buildPaymentSlip(req, items, settings);
    const buffer = await renderTemplate("paymentSlip", slip.values, slip.customize);

    await db.rpc(CDILV_RPC.paymentRequestLog, {
      p_request_id: id,
      p_actor_id: guard.access.userId,
      p_action: "printed",
      p_note: null,
    });

    const fileName = `De_nghi_thanh_toan_${req.code}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[api/payments/print] error:", err);
    return NextResponse.json({ error: "Không tạo được giấy đề nghị." }, { status: 500 });
  }
}
