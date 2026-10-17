import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ensureCurrentSession, loadQuizSettings } from "@/lib/quiz";
import { requireQuizAdmin } from "@/lib/quiz-access";
import { formatQuizDate, formatQuizTime } from "@/lib/quiz-shared";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

/** Admin bật / tắt đợt thi thủ công (dùng khi không chạy lịch tự động hoặc cần mở thêm). */
export async function POST(request: NextRequest) {
  try {
    const { userId, response } = await requireQuizAdmin();
    if (response) return response;

    const body = await request.json();
    const action = body.action;
    const writer = createServiceClient();
    const settings = await loadQuizSettings(writer);
    const now = new Date();
    const current = await ensureCurrentSession(writer, settings, now);

    if (action === "open") {
      if (current) {
        return NextResponse.json({ error: "Đang có đợt thi mở." }, { status: 400 });
      }
      const minutes = Number(body.durationMinutes);
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 360) {
        return NextResponse.json(
          { error: "Thời lượng mở thi phải từ 5 đến 360 phút." },
          { status: 400 },
        );
      }
      const startsAt = now.toISOString();
      const endsAt = new Date(now.getTime() + minutes * 60_000).toISOString();
      const { error } = await writer.from(CDILV_TABLE.quizSessions).insert({
        session_key: `manual-${now.getTime()}`,
        title: `Thi trắc nghiệm ${formatQuizDate(startsAt)} (${formatQuizTime(startsAt)})`,
        mode: "manual",
        starts_at: startsAt,
        ends_at: endsAt,
        created_by: userId,
      });
      if (error) throw error;

      revalidatePath("/admin/quiz");
      revalidatePath("/quiz");
      return NextResponse.json({
        success: true,
        message: `Đã bật thi trắc nghiệm đến ${formatQuizTime(endsAt)}.`,
      });
    }

    if (action === "close") {
      if (!current) {
        return NextResponse.json({ error: "Hiện không có đợt thi nào đang mở." }, { status: 400 });
      }
      const { error } = await writer
        .from(CDILV_TABLE.quizSessions)
        .update({ ends_at: now.toISOString() })
        .eq("id", current.id);
      if (error) throw error;

      revalidatePath("/admin/quiz");
      revalidatePath("/quiz");
      return NextResponse.json({ success: true, message: "Đã tắt đợt thi trắc nghiệm." });
    }

    return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  } catch (err: any) {
    console.error("[api/quiz/session] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể cập nhật đợt thi." },
      { status: 500 },
    );
  }
}
