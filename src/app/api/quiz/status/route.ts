import { NextRequest, NextResponse } from "next/server";
import { getQuizStatus, resolveQuizProgram } from "@/lib/quiz";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    // getClaims() xác thực JWT cục bộ, không gọi Auth server như getUser()
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ?? null;
    const db = createServiceClient();
    const [program, profileResult] = await Promise.all([
      resolveQuizProgram(db, request.nextUrl.searchParams.get("programId")),
      userId
        ? db.from(CDILV_TABLE.profiles).select("role, approval_status").eq("id", userId).maybeSingle()
        : null,
    ]);
    if (profileResult?.error) throw profileResult.error;
    const isApproved = profileResult?.data?.approval_status === "approved";
    const isAdmin = isApproved && profileResult?.data?.role === "admin";
    if (!program || (!program.is_active && !isAdmin)) {
      return NextResponse.json({ error: "Không tìm thấy chương trình trắc nghiệm." }, { status: 404 });
    }
    const status = await getQuizStatus(db, program, isApproved ? userId : null);
    return NextResponse.json(status);
  } catch (err: any) {
    console.error("[api/quiz/status] GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tải trạng thái thi trắc nghiệm." },
      { status: 500 },
    );
  }
}
