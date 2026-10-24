import { NextResponse } from "next/server";
import { getAlbumMemberContext } from "@/lib/album-access";
import { getQuizStatus } from "@/lib/quiz";
import { WEEKLY_QUIZ_PROGRAM_ID } from "@/lib/quiz-shared";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getAlbumMemberContext();
    const status = await getQuizStatus(
      createServiceClient(),
      WEEKLY_QUIZ_PROGRAM_ID,
      ctx.isApproved && ctx.user ? ctx.user.id : null,
    );
    return NextResponse.json(status);
  } catch (err: any) {
    console.error("[api/quiz/status] GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tải trạng thái thi trắc nghiệm." },
      { status: 500 },
    );
  }
}
