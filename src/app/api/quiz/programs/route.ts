import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { loadQuizProgram } from "@/lib/quiz";
import { requireQuizAdmin } from "@/lib/quiz-access";
import { WEEKLY_QUIZ_PROGRAM_ID } from "@/lib/quiz-shared";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

function parseProgram(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!name) return { error: "Vui lòng nhập tên chương trình." } as const;
  if (name.length > 150) return { error: "Tên chương trình tối đa 150 ký tự." } as const;
  if (description.length > 2000) return { error: "Mô tả tối đa 2000 ký tự." } as const;
  return { values: { name, description: description || null, is_active: body.isActive !== false } } as const;
}

function revalidateQuizPages(programId: string) {
  revalidatePath("/admin/quiz");
  revalidatePath("/quiz");
  revalidatePath(`/quiz/${programId}`);
}

/** Admin tạo chương trình trắc nghiệm mới (tên, mô tả, trạng thái). */
export async function POST(request: NextRequest) {
  try {
    const { userId, response } = await requireQuizAdmin();
    if (response) return response;

    const parsed = parseProgram(await request.json());
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const writer = createServiceClient();
    const { data, error } = await writer
      .from(CDILV_TABLE.quizPrograms)
      .insert({ ...parsed.values, created_by: userId })
      .select("id")
      .single();
    if (error) throw error;

    // Chương trình mới mở thi thủ công cho tới khi Admin cài lịch riêng.
    const { error: settingsErr } = await writer
      .from(CDILV_TABLE.quizSettings)
      .insert({ program_id: data.id, schedule_mode: "manual", updated_by: userId });
    if (settingsErr) throw settingsErr;

    revalidateQuizPages(data.id);
    return NextResponse.json({
      success: true,
      id: data.id,
      message: `Đã tạo chương trình trắc nghiệm "${parsed.values.name}".`,
    });
  } catch (err: any) {
    console.error("[api/quiz/programs] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tạo chương trình trắc nghiệm." },
      { status: 500 },
    );
  }
}

/** Admin sửa tên, mô tả và trạng thái Active của chương trình. */
export async function PATCH(request: NextRequest) {
  try {
    const { response } = await requireQuizAdmin();
    if (response) return response;

    const body = await request.json();
    const writer = createServiceClient();
    const program = await loadQuizProgram(writer, typeof body.id === "string" ? body.id : "");
    if (!program) {
      return NextResponse.json({ error: "Không tìm thấy chương trình trắc nghiệm." }, { status: 404 });
    }
    const parsed = parseProgram(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { error } = await writer
      .from(CDILV_TABLE.quizPrograms)
      .update({ ...parsed.values, updated_at: new Date().toISOString() })
      .eq("id", program.id);
    if (error) throw error;

    revalidateQuizPages(program.id);
    return NextResponse.json({ success: true, message: "Đã lưu thông tin chương trình." });
  } catch (err: any) {
    console.error("[api/quiz/programs] PATCH error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể lưu chương trình trắc nghiệm." },
      { status: 500 },
    );
  }
}

/** Xóa chương trình chưa có lượt làm bài nào (kèm câu hỏi, đợt thi trống và cài đặt của nó). */
export async function DELETE(request: NextRequest) {
  try {
    const { response } = await requireQuizAdmin();
    if (response) return response;

    const writer = createServiceClient();
    const program = await loadQuizProgram(writer, new URL(request.url).searchParams.get("id") ?? "");
    if (!program) {
      return NextResponse.json({ error: "Không tìm thấy chương trình trắc nghiệm." }, { status: 404 });
    }
    if (program.id === WEEKLY_QUIZ_PROGRAM_ID) {
      return NextResponse.json({ error: "Không thể xóa chương trình Trắc nghiệm tuần." }, { status: 400 });
    }

    const { count, error: countErr } = await writer
      .from(CDILV_TABLE.quizAttempts)
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id);
    if (countErr) throw countErr;
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Chương trình đã có lượt làm bài nên không thể xóa. Hãy chuyển sang Inactive để ẩn." },
        { status: 400 },
      );
    }

    const { data: sessions, error: sErr } = await writer
      .from(CDILV_TABLE.quizSessions)
      .select("id, result_post_id")
      .eq("program_id", program.id);
    if (sErr) throw sErr;
    const postIds = (sessions ?? []).map((s) => s.result_post_id).filter((id): id is string => Boolean(id));

    const { error: delSessionsErr } = await writer
      .from(CDILV_TABLE.quizSessions)
      .delete()
      .eq("program_id", program.id);
    if (delSessionsErr) throw delSessionsErr;
    if (postIds.length > 0) {
      const { error: delPostsErr } = await writer.from(CDILV_TABLE.posts).delete().in("id", postIds);
      if (delPostsErr) throw delPostsErr;
    }
    const { error: delQuestionsErr } = await writer
      .from(CDILV_TABLE.quizQuestions)
      .delete()
      .eq("program_id", program.id);
    if (delQuestionsErr) throw delQuestionsErr;
    const { error: delErr } = await writer.from(CDILV_TABLE.quizPrograms).delete().eq("id", program.id);
    if (delErr) throw delErr;

    revalidateQuizPages(program.id);
    return NextResponse.json({ success: true, message: `Đã xóa chương trình "${program.name}".` });
  } catch (err: any) {
    console.error("[api/quiz/programs] DELETE error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể xóa chương trình trắc nghiệm." },
      { status: 500 },
    );
  }
}
