import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireQuizAdmin } from "@/lib/quiz-access";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function intInRange(value: unknown, min: number, max: number) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, response } = await requireQuizAdmin();
    if (response) return response;

    const body = await request.json();
    const scheduleMode = body.schedule_mode === "manual" ? "manual" : "auto";
    const weekday = intInRange(body.schedule_weekday, 0, 6);
    const startTime = typeof body.start_time === "string" ? body.start_time.trim() : "";
    const endTime = typeof body.end_time === "string" ? body.end_time.trim() : "";

    if (weekday === null) {
      return NextResponse.json({ error: "Ngày trong tuần không hợp lệ." }, { status: 400 });
    }
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return NextResponse.json({ error: "Giờ bắt đầu / kết thúc phải theo dạng HH:MM." }, { status: 400 });
    }
    if (endTime <= startTime) {
      return NextResponse.json(
        { error: "Giờ kết thúc phải sau giờ bắt đầu (trong cùng một ngày)." },
        { status: 400 },
      );
    }

    const numbers = {
      questions_per_attempt: intInRange(body.questions_per_attempt, 1, 20),
      max_attempts: intInRange(body.max_attempts, 1, 20),
      time_limit_seconds: intInRange(body.time_limit_seconds, 10, 1800),
      base_points: intInRange(body.base_points, 0, 100),
      top1_bonus: intInRange(body.top1_bonus, 0, 100),
      top2_5_bonus: intInRange(body.top2_5_bonus, 0, 100),
      top6_10_bonus: intInRange(body.top6_10_bonus, 0, 100),
    };
    const labels: Record<keyof typeof numbers, string> = {
      questions_per_attempt: "Số câu mỗi lượt (1–20)",
      max_attempts: "Số lượt chơi tối đa (1–20)",
      time_limit_seconds: "Thời gian mỗi lượt (10–1800 giây)",
      base_points: "Điểm cơ bản (0–100)",
      top1_bonus: "Thưởng Hạng 1 (0–100)",
      top2_5_bonus: "Thưởng Hạng 2–5 (0–100)",
      top6_10_bonus: "Thưởng Hạng 6–10 (0–100)",
    };
    for (const key of Object.keys(numbers) as (keyof typeof numbers)[]) {
      if (numbers[key] === null) {
        return NextResponse.json({ error: `Giá trị không hợp lệ: ${labels[key]}.` }, { status: 400 });
      }
    }

    const postTitle = typeof body.result_post_title === "string" ? body.result_post_title.trim() : "";
    const postTemplate =
      typeof body.result_post_template === "string" ? body.result_post_template.trim() : "";
    if (postTitle.length > 200) {
      return NextResponse.json({ error: "Tiêu đề bài kết quả tối đa 200 ký tự." }, { status: 400 });
    }
    if (postTemplate.length > 20000) {
      return NextResponse.json({ error: "Nội dung bài kết quả quá dài." }, { status: 400 });
    }

    const writer = createServiceClient();
    const { error } = await writer
      .from(CDILV_TABLE.quizSettings)
      .upsert({
        id: 1,
        schedule_mode: scheduleMode,
        schedule_weekday: weekday,
        start_time: startTime,
        end_time: endTime,
        ...numbers,
        auto_finalize: body.auto_finalize !== false,
        result_post_title: postTitle || null,
        result_post_template: postTemplate || null,
        result_post_publish: body.result_post_publish !== false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;

    revalidatePath("/admin/quiz");
    revalidatePath("/quiz");
    return NextResponse.json({ success: true, message: "Đã lưu cài đặt thi trắc nghiệm." });
  } catch (err: any) {
    console.error("[api/quiz/settings] PATCH error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể lưu cài đặt." },
      { status: 500 },
    );
  }
}
