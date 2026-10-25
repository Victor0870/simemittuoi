import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  deleteDocumentDraft,
  loadDocumentDraft,
  parseDraftInput,
  updateDocumentDraft,
} from "@/lib/documents/drafts-server";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sửa bản nháp. Body: { templateId, title, values }. Văn bản đã ban hành không sửa được ở đây. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Bản nháp không hợp lệ." }, { status: 400 });

    const db = createServiceClient();
    const existing = await loadDocumentDraft(db, id);
    if (!existing) return NextResponse.json({ error: "Không tìm thấy bản nháp." }, { status: 404 });
    if (existing.status !== "nhap") {
      return NextResponse.json({ error: "Văn bản đã ban hành, không sửa được." }, { status: 409 });
    }

    const parsed = await parseDraftInput(db, await request.json().catch(() => null), existing.templateId);
    if (parsed.error !== null) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const draft = await updateDocumentDraft(db, id, parsed.value);
    if (!draft) return NextResponse.json({ error: "Văn bản đã ban hành, không sửa được." }, { status: 409 });
    return NextResponse.json({ success: true, draft });
  } catch (err: unknown) {
    console.error("[api/documents/drafts/[id]] PATCH error:", err);
    return NextResponse.json({ error: "Không lưu được bản nháp." }, { status: 500 });
  }
}

/** Xóa bản nháp (chỉ khi status = 'nhap'). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Bản nháp không hợp lệ." }, { status: 400 });

    const deleted = await deleteDocumentDraft(createServiceClient(), id);
    if (!deleted) return NextResponse.json({ error: "Không tìm thấy bản nháp hoặc văn bản đã ban hành." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/documents/drafts/[id]] DELETE error:", err);
    return NextResponse.json({ error: "Không xóa được bản nháp." }, { status: 500 });
  }
}
