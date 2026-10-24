import { NextRequest, NextResponse } from "next/server";
import { getAlbumMemberContext } from "@/lib/album-access";
import { getQuizStatus, resolveQuizProgram } from "@/lib/quiz";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAlbumMemberContext();
    const db = createServiceClient();
    const program = await resolveQuizProgram(db, request.nextUrl.searchParams.get("programId"));
    if (!program || (!program.is_active && !ctx.isAdmin)) {
      return NextResponse.json({ error: "Không tìm thấy chương trình trắc nghiệm." }, { status: 404 });
    }
    const status = await getQuizStatus(db, program, ctx.isApproved && ctx.user ? ctx.user.id : null);
    return NextResponse.json(status);
  } catch (err: any) {
    console.error("[api/quiz/status] GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tải trạng thái thi trắc nghiệm." },
      { status: 500 },
    );
  }
}
