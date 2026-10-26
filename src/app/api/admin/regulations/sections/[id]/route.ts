import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { updateRegulationSection } from "@/lib/regulations/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { access, response } = await requireAdmin();
    if (response) return response;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Thiếu ID điều khoản." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
    }

    const heading = typeof body.heading === "string" ? body.heading.trim() : "";
    const bodyText = typeof body.body_text === "string" ? body.body_text : "";

    if (!heading) {
      return NextResponse.json({ error: "Tiêu đề điều khoản không được để trống." }, { status: 400 });
    }

    const updated = await updateRegulationSection(
      id,
      { heading, body_text: bodyText },
      access.userId,
    );

    return NextResponse.json({
      success: true,
      section: updated,
      message: "Đã lưu thay đổi điều khoản.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể lưu điều khoản.";
    console.error("[api/admin/regulations/sections/[id]] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
