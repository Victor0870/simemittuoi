import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadDocumentDraft } from "@/lib/documents/drafts-server";
import { isUuid, loadDocumentRecord, markUnissued } from "@/lib/documents/registry-server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_STORAGE } from "@/lib/supabase/tables";

/**
 * Hủy ban hành (chỉ Quản trị viên): văn bản trở về bản nháp; số, ngày ban hành, người ban hành bị xóa,
 * cờ công khai tắt, bản scan đã ký của lần ban hành này bị xóa khỏi kho.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;
    if (!guard.access.isAdmin) {
      return NextResponse.json({ error: "Chỉ Quản trị viên mới hủy ban hành được." }, { status: 403 });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Văn bản không hợp lệ." }, { status: 400 });

    const db = createServiceClient();
    const row = await loadDocumentRecord(db, id);
    if (!row || row.status !== "da_ban_hanh") {
      return NextResponse.json({ error: "Không tìm thấy văn bản đã ban hành." }, { status: 404 });
    }
    if (!(await markUnissued(db, row))) {
      return NextResponse.json({ error: "Văn bản không còn ở trạng thái đã ban hành." }, { status: 409 });
    }
    if (row.scan_path) {
      const { error } = await db.storage.from(CDILV_STORAGE.documents).remove([row.scan_path]);
      if (error) console.error("[api/documents/registry/[id]/unissue] scan remove error:", error.message);
    }

    const draft = await loadDocumentDraft(db, id);
    return NextResponse.json({ success: true, draft });
  } catch (err: unknown) {
    console.error("[api/documents/registry/[id]/unissue] POST error:", err);
    return NextResponse.json({ error: "Không hủy ban hành được." }, { status: 500 });
  }
}
