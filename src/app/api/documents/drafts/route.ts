import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { insertDocumentDraft, loadDocumentDrafts, parseDraftInput } from "@/lib/documents/drafts-server";
import { createServiceClient } from "@/lib/supabase/service";

/** Danh sách bản nháp (status = 'nhap'). */
export async function GET() {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;
    const drafts = await loadDocumentDrafts(createServiceClient());
    return NextResponse.json({ drafts });
  } catch (err: unknown) {
    console.error("[api/documents/drafts] GET error:", err);
    return NextResponse.json({ error: "Không tải được bản nháp." }, { status: 500 });
  }
}

/** Lưu bản nháp mới. Body: { templateId, title, values }. Được lưu khi chưa nhập đủ trường bắt buộc. */
export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;

    const db = createServiceClient();
    const parsed = await parseDraftInput(db, await request.json().catch(() => null));
    if (parsed.error !== null) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const draft = await insertDocumentDraft(db, parsed.value, guard.access.userId);
    return NextResponse.json({ success: true, draft });
  } catch (err: unknown) {
    console.error("[api/documents/drafts] POST error:", err);
    return NextResponse.json({ error: "Không lưu được bản nháp." }, { status: 500 });
  }
}
