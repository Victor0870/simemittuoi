import { NextResponse } from "next/server";
import { buildImportTemplate, requireMemberImportAccess } from "@/lib/members/profile-import";
import { XLSX_MIME } from "@/lib/print/xlsx-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** File mẫu nhập hồ sơ đoàn viên: Mã NV + các trường hồ sơ được phép cập nhật. */
export async function GET() {
  const access = await requireMemberImportAccess();
  if (access instanceof NextResponse) return access;

  try {
    const buffer = await buildImportTemplate();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": 'attachment; filename="mau-nhap-ho-so-doan-vien.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[api/members/import/template] error:", err);
    return NextResponse.json({ error: "Không tạo được file mẫu." }, { status: 500 });
  }
}
