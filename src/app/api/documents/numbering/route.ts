import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadNumberingSeries, parseNumberingInput, saveNumberingSeries } from "@/lib/documents/numbering-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Cấu hình số văn bản theo loại: mẫu số, số chữ số, chu kỳ đếm. */
export async function GET() {
  const guard = await requirePermission(PERMISSIONS.postsManage);
  if (guard.response) return guard.response;
  try {
    const series = await loadNumberingSeries(createServiceClient());
    return NextResponse.json({ series });
  } catch (err: unknown) {
    console.error("[api/documents/numbering] GET error:", err);
    return NextResponse.json({ error: "Không tải được cấu hình số văn bản." }, { status: 500 });
  }
}

/** Body: { series: [{ type, format, pad, reset: "yearly" | "monthly" }] }. Chỉ đổi cấu hình, không đổi số đã ban hành. */
export async function PUT(request: NextRequest) {
  const guard = await requirePermission(PERMISSIONS.postsManage);
  if (guard.response) return guard.response;
  const parsed = parseNumberingInput(await request.json().catch(() => null));
  if (parsed.error !== null) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const db = createServiceClient();
    await saveNumberingSeries(db, parsed.value, guard.access.userId);
    return NextResponse.json({ success: true, series: await loadNumberingSeries(db) });
  } catch (err: unknown) {
    console.error("[api/documents/numbering] PUT error:", err);
    return NextResponse.json({ error: "Không lưu được cấu hình số văn bản." }, { status: 500 });
  }
}
