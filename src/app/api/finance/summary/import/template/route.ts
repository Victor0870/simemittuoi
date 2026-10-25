import { NextResponse } from "next/server";
import { loadCategories } from "@/lib/finance/server";
import { buildFinanceImportTemplate, requireFinanceWriteAccess } from "@/lib/finance/summary-excel";
import { XLSX_MIME } from "@/lib/print/xlsx-template";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await requireFinanceWriteAccess();
    if (access instanceof NextResponse) return access;

    const db = createServiceClient();
    const categories = await loadCategories(db);
    const buffer = await buildFinanceImportTemplate(categories);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": 'attachment; filename="Mau_nhap_thu_chi_cong_doan.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[api/finance/summary/import/template] error:", err);
    return NextResponse.json({ error: "Không tạo được file mẫu Excel." }, { status: 500 });
  }
}
