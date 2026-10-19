import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { isMemberSubmittableCategory, parseLifeEventInput, todayInVietnam } from "@/lib/life-events/registry";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const MAX_PER_DAY = 10;

export async function POST(request: NextRequest) {
  try {
    const access = await getCurrentAccess();
    if (!access) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    if (!access.isApproved) {
      return NextResponse.json({ error: "Tài khoản cần được phê duyệt để báo tin." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    const parsed = parseLifeEventInput(body, todayInVietnam());
    if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(" ") }, { status: 400 });
    if (!isMemberSubmittableCategory(parsed.value.category)) {
      return NextResponse.json({ error: "Nhóm tin này không nhận báo trực tuyến." }, { status: 400 });
    }

    const db = createServiceClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from(CDILV_TABLE.lifeEvents)
      .select("id", { count: "exact", head: true })
      .eq("member_id", access.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_DAY) {
      return NextResponse.json(
        { error: `Bạn đã gửi ${MAX_PER_DAY} tin trong 24 giờ qua. Vui lòng liên hệ trực tiếp Ban chấp hành.` },
        { status: 429 },
      );
    }

    const v = parsed.value;
    const { data, error } = await db
      .from(CDILV_TABLE.lifeEvents)
      .insert({
        member_id: access.userId,
        category: v.category,
        event_type: v.eventType,
        subject_relation: v.relation,
        subject_name: v.subjectName,
        event_date: v.eventDate,
        location: v.location,
        description: v.description,
      })
      .select("id, code")
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id, code: data.code });
  } catch (err: unknown) {
    console.error("[api/life-events] POST error:", err);
    return NextResponse.json({ error: "Không gửi được tin báo, vui lòng thử lại." }, { status: 500 });
  }
}
