import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ensureJudgeToken } from "@/lib/polls/judge-access";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.pollsManage);
    if (guard.response) return guard.response;

    const pollId = request.nextUrl.searchParams.get("pollId")?.trim();
    if (!pollId) {
      return NextResponse.json({ error: "Thiếu chương trình bình chọn." }, { status: 400 });
    }

    const db = createServiceClient();
    const { data: poll, error } = await db
      .from(CDILV_TABLE.polls)
      .select("id")
      .eq("id", pollId)
      .maybeSingle();

    if (error) throw error;
    if (!poll) {
      return NextResponse.json({ error: "Không tìm thấy chương trình bình chọn." }, { status: 404 });
    }

    const token = await ensureJudgeToken(db, pollId);
    return NextResponse.json({ token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không tạo được link giám khảo.";
    console.error("[api/polls/judge-link]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
