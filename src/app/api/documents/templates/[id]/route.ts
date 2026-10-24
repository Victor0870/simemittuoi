import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { parseDocumentTemplateInput, updateDocumentTemplate } from "@/lib/documents/templates-server";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sửa mẫu văn bản hoặc ngừng dùng / dùng lại (không có xóa cứng).
 * Body: các khóa cần đổi trong { name, docType, body, fields, isActive }.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Mẫu văn bản không hợp lệ." }, { status: 400 });

    const parsed = parseDocumentTemplateInput(await request.json().catch(() => null), true);
    if (parsed.error !== null) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const template = await updateDocumentTemplate(createServiceClient(), id, parsed.value, guard.access.userId);
    if (!template) return NextResponse.json({ error: "Không tìm thấy mẫu văn bản." }, { status: 404 });
    return NextResponse.json({ success: true, template });
  } catch (err: unknown) {
    console.error("[api/documents/templates/[id]] PATCH error:", err);
    return NextResponse.json({ error: "Không lưu được mẫu văn bản." }, { status: 500 });
  }
}
