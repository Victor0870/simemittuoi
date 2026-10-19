import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const MAX_ABS_POINTS = 10000;
const MAX_NOTE_LENGTH = 500;
const MAX_LABEL_LENGTH = 200;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard.response) return guard.response;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });

    const points = Number(body.points);
    if (!Number.isInteger(points) || points === 0 || Math.abs(points) > MAX_ABS_POINTS) {
      return NextResponse.json({ error: "Số điểm phải là số nguyên khác 0." }, { status: 400 });
    }
    const note = text(body.note, MAX_NOTE_LENGTH);
    if (!note) return NextResponse.json({ error: "Vui lòng nhập lý do / ghi chú cộng điểm." }, { status: 400 });
    const awardLabel = text(body.awardLabel, MAX_LABEL_LENGTH);
    const userId = text(body.userId, 64);
    const employeeCode = text(body.employeeCode, 64);
    const activityId = text(body.activityId, 64);

    const service = createServiceClient();

    if (userId) {
      const supabase = await createClient();
      const { data: profile } = await supabase
        .from(CDILV_TABLE.profiles)
        .select("id, employee_code")
        .eq("id", userId)
        .maybeSingle();
      if (!profile) return NextResponse.json({ error: "Không tìm thấy đoàn viên." }, { status: 404 });

      const { error } = await service.from(CDILV_TABLE.scoreEvents).insert({
        user_id: profile.id,
        employee_code: profile.employee_code || null,
        points,
        note,
        award_label: awardLabel,
        activity_id: activityId,
        created_by: guard.access.userId,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (employeeCode) {
      const { error } = await service.from(CDILV_TABLE.employeeScoreEvents).insert({
        employee_code: employeeCode,
        points,
        note,
        award_label: awardLabel,
        source: "admin_manual",
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Vui lòng chọn đoàn viên cần cộng điểm." }, { status: 400 });
  } catch (error) {
    console.error("[admin/scores] POST error:", error);
    const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
    return NextResponse.json({ error: message || "Có lỗi xảy ra khi cộng điểm." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard.response) return guard.response;

    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Thiếu mã lượt cộng điểm." }, { status: 400 });

    const service = createServiceClient();
    const { data, error } = await service.from(CDILV_TABLE.scoreEvents).delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: "Không tìm thấy lượt cộng điểm." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/scores] DELETE error:", error);
    const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
    return NextResponse.json({ error: message || "Không thể thu hồi lượt cộng điểm." }, { status: 500 });
  }
}
