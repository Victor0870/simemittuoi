import { NextRequest, NextResponse } from "next/server";
import { IMPORT_MAX_BYTES, previewMemberImport, requireMemberImportAccess } from "@/lib/members/profile-import";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Đọc file Excel và so sánh với hồ sơ hiện tại — không ghi gì vào database. */
export async function POST(request: NextRequest) {
  const access = await requireMemberImportAccess();
  if (access instanceof NextResponse) return access;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vui lòng chọn file Excel (.xlsx)." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Chỉ nhận file Excel định dạng .xlsx." }, { status: 400 });
  }
  if (file.size > IMPORT_MAX_BYTES) {
    return NextResponse.json({ error: "File vượt quá 2 MB." }, { status: 400 });
  }

  try {
    const result = await previewMemberImport(createServiceClient(), await file.arrayBuffer());
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[api/members/import/preview] error:", err);
    return NextResponse.json({ error: "Không xem trước được file, vui lòng thử lại." }, { status: 500 });
  }
}
