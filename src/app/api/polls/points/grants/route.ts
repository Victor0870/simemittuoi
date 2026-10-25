import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { normalizeEmployeeCode } from "@/lib/polls/judge-access";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { POINTS_BUDGET_MAX } from "@/lib/polls/vote-mode";

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.pollsManage);
    if (guard.response) return guard.response;

    const pollId = request.nextUrl.searchParams.get("pollId")?.trim();
    if (!pollId) {
      return NextResponse.json({ error: "Thiếu ID chương trình." }, { status: 400 });
    }

    const db = createServiceClient();
    const { data, error } = await db
      .from(CDILV_TABLE.pollPointGrants)
      .select("id, voter_key, employee_code, points, reason, granted_by_name, created_at")
      .eq("poll_id", pollId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({
      grants: (data ?? []).map((g) => ({
        id: g.id,
        voterKey: g.voter_key,
        employeeCode: g.employee_code,
        points: g.points,
        reason: g.reason,
        grantedByName: g.granted_by_name,
        createdAt: g.created_at,
      })),
    });
  } catch (err: any) {
    console.error("[api/polls/points/grants] GET error:", err);
    return NextResponse.json({ error: err?.message || "Không tải được lịch sử cộng điểm." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.pollsManage);
    if (guard.response) return guard.response;

    const body = await request.json().catch(() => ({}));
    const pollId = String(body?.pollId ?? "").trim();
    const points = Number(body?.points);
    const reason = String(body?.reason ?? "").trim();

    if (!pollId) {
      return NextResponse.json({ error: "Thiếu ID chương trình." }, { status: 400 });
    }
    if (!Number.isInteger(points) || points < 1 || points > POINTS_BUDGET_MAX) {
      return NextResponse.json(
        { error: `Số điểm cộng thêm phải là số nguyên từ 1 đến ${POINTS_BUDGET_MAX}.` },
        { status: 400 },
      );
    }
    if (!reason) {
      return NextResponse.json({ error: "Vui lòng nhập lý do cộng điểm." }, { status: 400 });
    }
    if (reason.length > 500) {
      return NextResponse.json({ error: "Lý do tối đa 500 ký tự." }, { status: 400 });
    }

    const db = createServiceClient();
    const { data: poll, error: pollError } = await db
      .from(CDILV_TABLE.polls)
      .select("id, vote_mode")
      .eq("id", pollId)
      .maybeSingle();
    if (pollError) throw pollError;
    if (!poll) {
      return NextResponse.json({ error: "Không tìm thấy chương trình bình chọn." }, { status: 404 });
    }
    if (poll.vote_mode !== "points") {
      return NextResponse.json(
        { error: "Chỉ cộng điểm được cho chương trình dùng hình thức Vote theo point." },
        { status: 400 },
      );
    }

    const employeeCode = normalizeEmployeeCode(body?.employeeCode);
    if (!employeeCode) {
      return NextResponse.json({ error: "Vui lòng nhập mã nhân viên của người được cộng điểm." }, { status: 400 });
    }
    const voterKey = `emp:${employeeCode}`;

    const { data: profile } = await db
      .from(CDILV_TABLE.profiles)
      .select("full_name")
      .eq("id", guard.access.userId)
      .maybeSingle();

    const { error: insertError } = await db.from(CDILV_TABLE.pollPointGrants).insert({
      poll_id: pollId,
      voter_key: voterKey,
      voter_kind: "individual",
      employee_code: employeeCode,
      points,
      reason,
      granted_by: guard.access.userId,
      granted_by_name: profile?.full_name?.trim() || null,
    });
    if (insertError) throw insertError;

    return NextResponse.json({ success: true, message: `Đã cộng ${points} điểm.` });
  } catch (err: any) {
    console.error("[api/polls/points/grants] POST error:", err);
    return NextResponse.json({ error: err?.message || "Không cộng được điểm." }, { status: 500 });
  }
}
