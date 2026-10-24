import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { insertDocumentTemplate, loadDocumentTemplates, parseDocumentTemplateInput } from "@/lib/documents/templates-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Danh sách mẫu văn bản (kể cả đã ngừng dùng). */
export async function GET() {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;
    const templates = await loadDocumentTemplates(createServiceClient());
    return NextResponse.json({ templates });
  } catch (err: unknown) {
    console.error("[api/documents/templates] GET error:", err);
    return NextResponse.json({ error: "Không tải được mẫu văn bản." }, { status: 500 });
  }
}

/** Tạo mẫu văn bản. Body: { name, docType, body, fields: [{ key, label, type, required }], isActive }. */
export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;

    const parsed = parseDocumentTemplateInput(await request.json().catch(() => null), false);
    if (parsed.error !== null) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const template = await insertDocumentTemplate(createServiceClient(), parsed.value, guard.access.userId);
    return NextResponse.json({ success: true, template });
  } catch (err: unknown) {
    console.error("[api/documents/templates] POST error:", err);
    return NextResponse.json({ error: "Không tạo được mẫu văn bản." }, { status: 500 });
  }
}
