import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { extractSectionToPost } from "@/lib/regulations/server";

export async function POST(request: NextRequest) {
  try {
    const { access, response } = await requireAdmin();
    if (response) return response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
    }

    const sectionId = typeof body.sectionId === "string" ? body.sectionId.trim() : "";
    if (!sectionId) {
      return NextResponse.json({ error: "Thiếu mã điều khoản (sectionId)." }, { status: 400 });
    }

    const result = await extractSectionToPost(sectionId, access.userId);

    return NextResponse.json({
      success: true,
      postId: result.postId,
      title: result.title,
      message: "Đã trích điều khoản thành bản nháp bài viết mới (chưa xuất bản).",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể trích bài viết.";
    console.error("[api/admin/regulations/extract-post] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
