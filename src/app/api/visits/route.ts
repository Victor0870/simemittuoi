import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadLifeEventRow } from "@/lib/life-events/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { parseVisitInput } from "@/lib/visits/registry";
import { findProfileIdByEmployeeCode } from "@/lib/visits/server";

/** Lập đề nghị thăm hỏi. Body: VisitInput + lifeEventId? */
export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.visitsCreate);
    if (guard.response) return guard.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseVisitInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(" ") }, { status: 400 });

    const db = createServiceClient();
    let lifeEventId: string | null = null;
    if (typeof body.lifeEventId === "string" && body.lifeEventId) {
      const event = await loadLifeEventRow(db, body.lifeEventId);
      if (!event) return NextResponse.json({ error: "Không tìm thấy tin báo gốc." }, { status: 400 });
      lifeEventId = event.id;
    }

    const v = parsed.value;
    const { data, error } = await db
      .from(CDILV_TABLE.visitRequests)
      .insert({
        life_event_id: lifeEventId,
        member_id: await findProfileIdByEmployeeCode(db, v.employeeCode),
        member_employee_code: v.employeeCode,
        member_name: v.memberName,
        member_department: v.memberDepartment,
        event_type: v.eventType,
        reason: v.reason,
        amount: v.amount,
        visitor_name: v.visitorName,
        note: v.note,
        created_by: guard.access.userId,
      })
      .select("id, code")
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id, code: data.code });
  } catch (err: unknown) {
    console.error("[api/visits] create error:", err);
    return NextResponse.json({ error: "Không lập được đề nghị thăm hỏi." }, { status: 500 });
  }
}
