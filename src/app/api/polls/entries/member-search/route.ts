import { NextRequest, NextResponse } from "next/server";
import { getSubmitter } from "@/lib/polls/entries-server";
import { searchEmployees } from "@/lib/employees/search";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Gợi ý thành viên khi người chơi nộp bài (đoàn viên đã duyệt). Chỉ trả tên, mã, bộ phận. */
export async function GET(request: NextRequest) {
  try {
    const auth = await getSubmitter();
    if ("error" in auth) return NextResponse.json({ error: auth.error, results: [] }, { status: auth.status });
    const results = await searchEmployees(createServiceClient(), request.nextUrl.searchParams.get("q") || "");
    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi tìm nhân viên.";
    console.error("[api/polls/entries/member-search]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
