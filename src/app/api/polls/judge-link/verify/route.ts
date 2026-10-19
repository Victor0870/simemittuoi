import { NextRequest, NextResponse } from "next/server";
import { isValidJudgeToken } from "@/lib/polls/judge-access";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function GET(request: NextRequest) {
  const pollId = request.nextUrl.searchParams.get("pollId")?.trim() ?? "";
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!pollId || !token) {
    return NextResponse.json({ ok: false }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const db = createServiceClient();
    const { data: poll, error } = await db
      .from(CDILV_TABLE.polls)
      .select("id, has_judges")
      .eq("id", pollId)
      .maybeSingle();

    if (error) throw error;
    if (!poll?.has_judges) {
      return NextResponse.json({ ok: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const ok = await isValidJudgeToken(db, pollId, token);
    return NextResponse.json({ ok }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[api/polls/judge-link/verify]", err);
    return NextResponse.json({ ok: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
