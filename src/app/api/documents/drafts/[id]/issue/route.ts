import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  ScanError,
  assembleScan,
  isIssueNumberTaken,
  isUuid,
  loadDocumentRecord,
  loadIssuedDocument,
  markIssued,
  parseIssueInput,
  parseScanUpload,
  removeScanChunks,
} from "@/lib/documents/registry-server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_STORAGE } from "@/lib/supabase/tables";

export const maxDuration = 60;

/**
 * Đánh dấu bản nháp đã ban hành.
 * Body: { soVanBan, ngayBanHanh (YYYY-MM-DD), uploadId, total, mime, size } – các phần bản scan đã tải lên trước qua /scan.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(PERMISSIONS.postsManage);
  if (guard.response) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Văn bản không hợp lệ." }, { status: 400 });

  const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const upload = parseScanUpload(raw);
  if (!upload) return NextResponse.json({ error: "Vui lòng chọn bản scan đã ký, đóng dấu (PDF hoặc ảnh, tối đa 10 MB)." }, { status: 400 });

  const db = createServiceClient();
  let scanPath: string | null = null;
  try {
    const parsed = parseIssueInput(raw);
    if (parsed.error !== null) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const row = await loadDocumentRecord(db, id);
    if (!row) return NextResponse.json({ error: "Không tìm thấy văn bản." }, { status: 404 });
    if (row.status !== "nhap") return NextResponse.json({ error: "Văn bản đã được ban hành." }, { status: 409 });
    if (await isIssueNumberTaken(db, row, parsed.value)) {
      return NextResponse.json(
        { error: `Số “${parsed.value.soVanBan}” đã dùng cho văn bản cùng loại trong năm ${parsed.value.ngayBanHanh.slice(0, 4)}.` },
        { status: 409 },
      );
    }

    scanPath = await assembleScan(db, id, upload);
    const result = await markIssued(db, id, parsed.value, scanPath, guard.access.userId);
    if (!result.ok) {
      await db.storage.from(CDILV_STORAGE.documents).remove([scanPath]);
      scanPath = null;
      return NextResponse.json(
        { error: result.duplicate ? "Số văn bản đã được dùng cho văn bản cùng loại trong năm." : "Văn bản đã được ban hành." },
        { status: 409 },
      );
    }

    scanPath = null;
    const document = await loadIssuedDocument(db, id);
    return NextResponse.json({ success: true, document });
  } catch (err: unknown) {
    if (scanPath) await db.storage.from(CDILV_STORAGE.documents).remove([scanPath]).catch(() => null);
    if (err instanceof ScanError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[api/documents/drafts/[id]/issue] POST error:", err);
    return NextResponse.json({ error: "Không ban hành được văn bản." }, { status: 500 });
  } finally {
    await removeScanChunks(db, id, upload.uploadId, upload.total).catch(() => null);
  }
}
