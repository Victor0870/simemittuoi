import { NextRequest, NextResponse } from "next/server";
import {
  FINANCE_IMPORT_MAX_BYTES,
  previewFinanceImport,
  requireFinanceWriteAccess,
} from "@/lib/finance/summary-excel";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const access = await requireFinanceWriteAccess();
    if (access instanceof NextResponse) return access;

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Vui lòng chọn file Excel (.xlsx)." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Chỉ hỗ trợ file Excel định dạng .xlsx." }, { status: 400 });
    }
    if (file.size > FINANCE_IMPORT_MAX_BYTES) {
      return NextResponse.json({ error: "File vượt quá giới hạn 2 MB." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const result = await previewFinanceImport(createServiceClient(), buffer);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[api/finance/summary/import/preview] error:", err);
    return NextResponse.json({ error: "Không đọc được file Excel." }, { status: 500 });
  }
}
