import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { selectAllRows } from "@/lib/quiz";
import { requireQuizAdmin } from "@/lib/quiz-access";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const MAX_IMPORT_ROWS = 2000;

type QuestionValues = {
  content: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
};

function parseQuestion(raw: unknown): { values: QuestionValues } | { error: string } {
  const body = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
  const content = text(body.content);
  const options = [text(body.option_1), text(body.option_2), text(body.option_3), text(body.option_4)];
  const correct = Number(body.correct_option);

  if (!content) return { error: "Thiếu nội dung câu hỏi." };
  if (content.length > 1000) return { error: "Nội dung câu hỏi tối đa 1000 ký tự." };
  if (options.some((o) => !o)) return { error: "Cần nhập đủ 4 đáp án." };
  if (options.some((o) => o.length > 300)) return { error: "Mỗi đáp án tối đa 300 ký tự." };
  if (!Number.isInteger(correct) || correct < 1 || correct > 4) {
    return { error: "Câu trả lời phải là 1, 2, 3 hoặc 4." };
  }

  return {
    values: {
      content,
      option_1: options[0],
      option_2: options[1],
      option_3: options[2],
      option_4: options[3],
      correct_option: correct,
    },
  };
}

function normalizeContent(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Thêm 1 câu hỏi hoặc nhập nhiều câu từ Excel (luôn cộng thêm vào ngân hàng, bỏ qua câu trùng). */
export async function POST(request: NextRequest) {
  try {
    const { userId, response } = await requireQuizAdmin();
    if (response) return response;

    const body = await request.json();
    const items: unknown[] = Array.isArray(body.questions) ? body.questions : [body];
    const isImport = Array.isArray(body.questions);

    if (items.length === 0) {
      return NextResponse.json({ error: "Không có câu hỏi nào để thêm." }, { status: 400 });
    }
    if (items.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} câu hỏi.` },
        { status: 400 },
      );
    }

    const writer = createServiceClient();
    const existing = await selectAllRows<{ content: string }>((from, to) =>
      writer.from(CDILV_TABLE.quizQuestions).select("content").order("id").range(from, to),
    );
    const seen = new Set(existing.map((q) => normalizeContent(q.content)));

    const rows: (QuestionValues & { created_by: string })[] = [];
    const invalid: string[] = [];
    let duplicates = 0;

    items.forEach((item, index) => {
      const parsed = parseQuestion(item);
      if ("error" in parsed) {
        const rowNo = (item as { rowNumber?: number })?.rowNumber ?? index + 1;
        invalid.push(isImport ? `Dòng ${rowNo}: ${parsed.error}` : parsed.error);
        return;
      }
      const key = normalizeContent(parsed.values.content);
      if (seen.has(key)) {
        duplicates += 1;
        return;
      }
      seen.add(key);
      rows.push({ ...parsed.values, created_by: userId! });
    });

    if (!isImport) {
      if (invalid.length) return NextResponse.json({ error: invalid[0] }, { status: 400 });
      if (duplicates) {
        return NextResponse.json(
          { error: "Câu hỏi này đã có trong ngân hàng câu hỏi." },
          { status: 400 },
        );
      }
    }

    if (rows.length > 0) {
      const { error } = await writer.from(CDILV_TABLE.quizQuestions).insert(rows);
      if (error) throw error;
    }

    revalidatePath("/admin/quiz");
    return NextResponse.json({
      success: true,
      inserted: rows.length,
      duplicates,
      invalid,
      message: isImport
        ? `Đã thêm ${rows.length} câu hỏi vào ngân hàng.` +
          (duplicates ? ` Bỏ qua ${duplicates} câu trùng.` : "") +
          (invalid.length ? ` ${invalid.length} dòng lỗi.` : "")
        : "Đã thêm câu hỏi.",
    });
  } catch (err: any) {
    console.error("[api/quiz/questions] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể thêm câu hỏi." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { response } = await requireQuizAdmin();
    if (response) return response;

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "Thiếu mã câu hỏi." }, { status: 400 });

    const parsed = parseQuestion(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const writer = createServiceClient();
    const { error } = await writer
      .from(CDILV_TABLE.quizQuestions)
      .update({ ...parsed.values, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/quiz");
    return NextResponse.json({ success: true, message: "Đã cập nhật câu hỏi." });
  } catch (err: any) {
    console.error("[api/quiz/questions] PATCH error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể cập nhật câu hỏi." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { response } = await requireQuizAdmin();
    if (response) return response;

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu mã câu hỏi." }, { status: 400 });

    const writer = createServiceClient();
    const { error } = await writer.from(CDILV_TABLE.quizQuestions).delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/quiz");
    return NextResponse.json({ success: true, message: "Đã xóa câu hỏi." });
  } catch (err: any) {
    console.error("[api/quiz/questions] DELETE error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể xóa câu hỏi." },
      { status: 500 },
    );
  }
}
