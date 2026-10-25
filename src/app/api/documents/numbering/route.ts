import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadNumberingConfig, parseNumberingInput, saveNumberingSeries } from "@/lib/documents/numbering-server";
import { DOCUMENT_TYPE_LABEL } from "@/lib/documents/templates";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Cấu hình số văn bản theo loại (mẫu số, số chữ số, chu kỳ đếm, số bắt đầu) kèm trạng thái kỳ đếm hiện tại. */
export async function GET() {
  const guard = await requirePermission(PERMISSIONS.postsManage);
  if (guard.response) return guard.response;
  try {
    return NextResponse.json(await loadNumberingConfig(createServiceClient()));
  } catch (err: unknown) {
    console.error("[api/documents/numbering] GET error:", err);
    return NextResponse.json({ error: "Không tải được cấu hình số văn bản." }, { status: 500 });
  }
}

/**
 * Body: { series: [{ type, format, pad, reset: "yearly" | "monthly", start }] }.
 * start áp dụng cho kỳ đếm hiện tại, phải lớn hơn số đã cấp gần nhất trong kỳ (không lùi số). Không đổi số đã ban hành.
 */
export async function PUT(request: NextRequest) {
  const guard = await requirePermission(PERMISSIONS.postsManage);
  if (guard.response) return guard.response;
  const parsed = parseNumberingInput(await request.json().catch(() => null));
  if (parsed.error !== null) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const db = createServiceClient();
    const result = await saveNumberingSeries(db, parsed.value, guard.access.userId);
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            `${DOCUMENT_TYPE_LABEL[result.type]}: số bắt đầu phải lớn hơn ${result.lastIssued} ` +
            "(số đã cấp gần nhất trong kỳ hiện tại), không thể lùi số. Chưa lưu thay đổi nào.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, ...(await loadNumberingConfig(db)) });
  } catch (err: unknown) {
    console.error("[api/documents/numbering] PUT error:", err);
    return NextResponse.json({ error: "Không lưu được cấu hình số văn bản." }, { status: 500 });
  }
}
