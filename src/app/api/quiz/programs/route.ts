import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireQuizAdmin } from "@/lib/quiz-access";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

/** Admin tạo chương trình trắc nghiệm mới (tên, mô tả, trạng thái). */
export async function POST(request: NextRequest) {
  try {
    const { userId, response } = await requireQuizAdmin();
    if (response) return response;

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Vui lòng nhập tên chương trình." }, { status: 400 });
    }
    if (name.length > 150) {
      return NextResponse.json({ error: "Tên chương trình tối đa 150 ký tự." }, { status: 400 });
    }
    if (description.length > 2000) {
      return NextResponse.json({ error: "Mô tả tối đa 2000 ký tự." }, { status: 400 });
    }

    const writer = createServiceClient();
    const { data, error } = await writer
      .from(CDILV_TABLE.quizPrograms)
      .insert({
        name,
        description: description || null,
        is_active: body.isActive !== false,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    revalidatePath("/admin/quiz");
    return NextResponse.json({
      success: true,
      id: data.id,
      message: `Đã tạo chương trình trắc nghiệm "${name}".`,
    });
  } catch (err: any) {
    console.error("[api/quiz/programs] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tạo chương trình trắc nghiệm." },
      { status: 500 },
    );
  }
}
