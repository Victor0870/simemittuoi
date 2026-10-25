import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { isUuid, setDocumentPublic } from "@/lib/documents/registry-server";
import { createServiceClient } from "@/lib/supabase/service";

/** Bật / tắt cờ công khai của văn bản đã ban hành. Body: { congKhai: boolean }. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Văn bản không hợp lệ." }, { status: 400 });

    const body = (await request.json().catch(() => null)) as { congKhai?: unknown } | null;
    if (typeof body?.congKhai !== "boolean") return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });

    const ok = await setDocumentPublic(createServiceClient(), id, body.congKhai);
    if (!ok) return NextResponse.json({ error: "Không tìm thấy văn bản đã ban hành." }, { status: 404 });
    return NextResponse.json({ success: true, congKhai: body.congKhai });
  } catch (err: unknown) {
    console.error("[api/documents/registry/[id]] PATCH error:", err);
    return NextResponse.json({ error: "Không lưu được." }, { status: 500 });
  }
}
