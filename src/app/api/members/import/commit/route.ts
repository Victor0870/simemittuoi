import { NextRequest, NextResponse } from "next/server";
import { commitMemberImport, parseCommitBody, requireMemberImportAccess } from "@/lib/members/profile-import";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cập nhật các dòng đã xem trước; mọi dòng được kiểm tra lại ở server, dòng lỗi bị bỏ qua. */
export async function POST(request: NextRequest) {
  const access = await requireMemberImportAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const entries = parseCommitBody(body);
  if ("error" in entries) return NextResponse.json({ error: entries.error }, { status: 400 });

  try {
    const result = await commitMemberImport(createServiceClient(), access.userId, entries);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[api/members/import/commit] error:", err);
    return NextResponse.json({ error: "Không cập nhật được hồ sơ, vui lòng thử lại." }, { status: 500 });
  }
}
