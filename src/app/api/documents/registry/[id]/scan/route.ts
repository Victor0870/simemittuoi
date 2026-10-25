import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { isUuid, loadDocumentRecord } from "@/lib/documents/registry-server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_STORAGE } from "@/lib/supabase/tables";

const SIGNED_URL_SECONDS = 60;

/** Mở bản scan (xem hoặc tải trong trình xem của trình duyệt) qua link ký hạn ngắn 60 giây. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Văn bản không hợp lệ." }, { status: 400 });

    const db = createServiceClient();
    const row = await loadDocumentRecord(db, id);
    if (!row || row.status !== "da_ban_hanh" || !row.scan_path) {
      return NextResponse.json({ error: "Không tìm thấy bản scan." }, { status: 404 });
    }

    const { data, error } = await db.storage
      .from(CDILV_STORAGE.documents)
      .createSignedUrl(row.scan_path, SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) throw error ?? new Error("signed url");

    const response = NextResponse.redirect(data.signedUrl, 302);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err: unknown) {
    console.error("[api/documents/registry/[id]/scan] GET error:", err);
    return NextResponse.json({ error: "Không mở được bản scan." }, { status: 500 });
  }
}
