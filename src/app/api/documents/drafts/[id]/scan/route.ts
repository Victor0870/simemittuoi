import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SCAN_LIMITS } from "@/lib/documents/registry";
import { isUuid, loadDocumentRecord, parseScanUpload, scanChunkPath } from "@/lib/documents/registry-server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_STORAGE } from "@/lib/supabase/tables";

/**
 * Tải lên một phần của bản scan đã ký (multipart: chunk, index, total, uploadId, mime, size).
 * Tệp được chia nhỏ vì máy chủ giới hạn kích thước mỗi request; bước ban hành sẽ ghép và kiểm tra.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Văn bản không hợp lệ." }, { status: 400 });

    const form = await request.formData().catch(() => null);
    const chunk = form?.get("chunk");
    const upload = form
      ? parseScanUpload({
          uploadId: form.get("uploadId"),
          total: form.get("total"),
          mime: form.get("mime"),
          size: form.get("size"),
        })
      : null;
    const index = Number(form?.get("index"));
    if (!upload) {
      return NextResponse.json({ error: "Chỉ nhận PDF hoặc ảnh (JPG, PNG, WEBP), tối đa 10 MB." }, { status: 400 });
    }
    if (!(chunk instanceof Blob) || chunk.size === 0 || chunk.size > SCAN_LIMITS.chunkBytes) {
      return NextResponse.json({ error: "Phần tệp tải lên không hợp lệ." }, { status: 400 });
    }
    if (!Number.isInteger(index) || index < 0 || index >= upload.total) {
      return NextResponse.json({ error: "Phần tệp tải lên không hợp lệ." }, { status: 400 });
    }

    const db = createServiceClient();
    const row = await loadDocumentRecord(db, id);
    if (!row) return NextResponse.json({ error: "Không tìm thấy văn bản." }, { status: 404 });
    if (row.status !== "nhap") return NextResponse.json({ error: "Văn bản đã ban hành." }, { status: 409 });

    const { error } = await db.storage
      .from(CDILV_STORAGE.documents)
      .upload(scanChunkPath(id, upload.uploadId, index), new Uint8Array(await chunk.arrayBuffer()), {
        contentType: upload.mime,
        upsert: true,
      });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/documents/drafts/[id]/scan] POST error:", err);
    return NextResponse.json({ error: "Không tải được bản scan lên." }, { status: 500 });
  }
}
