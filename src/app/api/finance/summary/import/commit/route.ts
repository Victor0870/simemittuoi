import { NextRequest, NextResponse } from "next/server";
import { commitFinanceImport, requireFinanceWriteAccess } from "@/lib/finance/summary-excel";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const access = await requireFinanceWriteAccess();
    if (access instanceof NextResponse) return access;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Dữ liệu xác nhận không hợp lệ." }, { status: 400 });
    }

    const result = await commitFinanceImport(createServiceClient(), access.userId, body);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[api/finance/summary/import/commit] error:", err);
    return NextResponse.json({ error: "Không lưu được dữ liệu thu chi từ Excel." }, { status: 500 });
  }
}
