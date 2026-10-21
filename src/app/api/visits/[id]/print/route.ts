import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { vndInWords } from "@/lib/print/vn-money";
import { XLSX_MIME, renderTemplate } from "@/lib/print/xlsx-template";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";
import { loadVisitRequestRow } from "@/lib/visits/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function vnDate(iso: string): Date {
  const [y, m, d] = todayInVietnam(new Date(iso)).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Tải phiếu thăm hỏi (mẫu C11-TLĐ) đã điền sẵn. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requirePermission(PERMISSIONS.visitsView);
    if (guard.response) return guard.response;

    const db = createServiceClient();
    const req = await loadVisitRequestRow(db, id);
    if (!req) return NextResponse.json({ error: "Không tìm thấy phiếu đề nghị." }, { status: 404 });
    if (req.status === "rejected" || req.status === "cancelled") {
      return NextResponse.json({ error: "Phiếu đã bị từ chối hoặc đã hủy, không in được." }, { status: 409 });
    }

    const settings = await loadFormSettings(db);
    const buffer = await renderTemplate("visitSlip", {
      A1: settings.unionName,
      C5: req.visitor_name,
      C6: req.member_name,
      C7: req.reason,
      C9: req.amount,
      C10: vndInWords(req.amount),
      C12: vnDate(req.created_at),
      A19: req.visitor_name,
      C13: settings.chairmanTitle,
      C19: settings.chairmanName,
    });

    await db.rpc(CDILV_RPC.visitRequestLog, {
      p_request_id: id,
      p_actor_id: guard.access.userId,
      p_action: "printed",
      p_note: null,
    });

    const fileName = `Phieu_tham_hoi_${req.code}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[api/visits/print] error:", err);
    return NextResponse.json({ error: "Không tạo được phiếu in." }, { status: 500 });
  }
}
