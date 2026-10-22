import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadVisitCandidates } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Phiếu thăm hỏi đã duyệt chưa gom vào đề nghị thanh toán nào. ?except=<id đề nghị đang sửa> */
export async function GET(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.paymentsCreate);
    if (guard.response) return guard.response;
    if (!hasPermission(guard.access, PERMISSIONS.visitsView)) return NextResponse.json({ candidates: [] });
    const except = request.nextUrl.searchParams.get("except") ?? undefined;
    const candidates = await loadVisitCandidates(createServiceClient(), except);
    return NextResponse.json({ candidates });
  } catch (err: unknown) {
    console.error("[api/payments/visit-candidates] error:", err);
    return NextResponse.json({ error: "Không tải được phiếu thăm hỏi." }, { status: 500 });
  }
}
