import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";
import { formatVnd, parseVisitInput } from "@/lib/visits/registry";
import { findProfileIdByEmployeeCode, loadVisitRequestRow } from "@/lib/visits/server";

type Params = { params: Promise<{ id: string }> };

/** Sửa đề nghị khi còn chờ duyệt. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requirePermission(PERMISSIONS.visitsCreate);
    if (guard.response) return guard.response;

    const db = createServiceClient();
    const current = await loadVisitRequestRow(db, id);
    if (!current) return NextResponse.json({ error: "Không tìm thấy phiếu đề nghị." }, { status: 404 });
    if (current.status !== "proposed") {
      return NextResponse.json({ error: "Chỉ sửa được phiếu đang chờ duyệt." }, { status: 409 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseVisitInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(" ") }, { status: 400 });
    const v = parsed.value;

    const changes: string[] = [];
    if (v.employeeCode !== current.member_employee_code || v.memberName !== current.member_name) {
      changes.push(`Đoàn viên: ${current.member_name} → ${v.memberName}`);
    }
    if (v.reason !== current.reason) changes.push(`Lý do: ${v.reason}`);
    if (v.amount !== current.amount) changes.push(`Số tiền: ${formatVnd(current.amount)} → ${formatVnd(v.amount)}`);
    if (v.visitorName !== current.visitor_name) changes.push(`Người thăm hỏi: ${v.visitorName}`);
    if ((v.note ?? null) !== (current.note ?? null)) changes.push("Ghi chú");
    if ((v.eventType ?? null) !== (current.event_type ?? null)) changes.push("Loại sự việc");
    if (!changes.length) return NextResponse.json({ success: true });

    const { error } = await db
      .from(CDILV_TABLE.visitRequests)
      .update({
        member_id:
          v.employeeCode === current.member_employee_code
            ? current.member_id
            : await findProfileIdByEmployeeCode(db, v.employeeCode),
        member_employee_code: v.employeeCode,
        member_name: v.memberName,
        member_department: v.memberDepartment,
        event_type: v.eventType,
        reason: v.reason,
        amount: v.amount,
        visitor_name: v.visitorName,
        note: v.note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "proposed");
    if (error) throw error;

    await db.rpc(CDILV_RPC.visitRequestLog, {
      p_request_id: id,
      p_actor_id: guard.access.userId,
      p_action: "edited",
      p_note: changes.join("; ").slice(0, 1000),
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/visits/[id]] update error:", err);
    return NextResponse.json({ error: "Không sửa được đề nghị." }, { status: 500 });
  }
}
