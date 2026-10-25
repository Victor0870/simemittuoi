import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { isValidDateValue } from "@/lib/documents/compose";
import { previewDocumentNumber } from "@/lib/documents/numbering-server";
import { isDocumentType } from "@/lib/documents/templates";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Số dự kiến nếu ban hành ngay: ?type=<loại>&date=YYYY-MM-DD. Không tăng bộ đếm; số chính thức cấp lúc ban hành. */
export async function GET(request: NextRequest) {
  const guard = await requirePermission(PERMISSIONS.postsManage);
  if (guard.response) return guard.response;
  const type = request.nextUrl.searchParams.get("type");
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!isDocumentType(type) || !isValidDateValue(date)) {
    return NextResponse.json({ error: "Loại văn bản hoặc ngày không hợp lệ." }, { status: 400 });
  }
  try {
    const number = await previewDocumentNumber(createServiceClient(), type, date);
    return NextResponse.json({ number });
  } catch (err: unknown) {
    console.error("[api/documents/numbering/preview] GET error:", err);
    return NextResponse.json({ error: "Không xem trước được số văn bản." }, { status: 500 });
  }
}
