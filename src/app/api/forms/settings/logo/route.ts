import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { PRINT_LOGO_MAX_BYTES, PRINT_LOGO_TYPES, printLogoUrl } from "@/lib/print/logo";
import { loadPrintLogoPath, readImageInfo, savePrintLogoPath } from "@/lib/print/logo-server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_STORAGE } from "@/lib/supabase/tables";

export const runtime = "nodejs";

async function removeFile(path: string | null) {
  if (!path) return;
  const { error } = await createServiceClient().storage.from(CDILV_STORAGE.printAssets).remove([path]);
  if (error) console.error("[api/forms/settings/logo] remove old file error:", error.message);
}

/** Tải lên / thay logo in trên phiếu (chỉ Quản trị viên). Body: form-data { file }. */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard.response) return guard.response;

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Vui lòng chọn ảnh logo." }, { status: 400 });
    }
    const ext = PRINT_LOGO_TYPES[file.type];
    if (!ext) return NextResponse.json({ error: "Chỉ hỗ trợ ảnh PNG hoặc JPG." }, { status: 400 });
    if (file.size > PRINT_LOGO_MAX_BYTES) {
      return NextResponse.json({ error: "Dung lượng logo tối đa là 2MB." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const info = readImageInfo(buffer);
    if (!info || (info.extension === "png") !== (ext === "png")) {
      return NextResponse.json({ error: "File không phải ảnh PNG / JPG hợp lệ." }, { status: 400 });
    }

    const db = createServiceClient();
    const previous = await loadPrintLogoPath(db);
    const path = `logo/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await db.storage
      .from(CDILV_STORAGE.printAssets)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    try {
      await savePrintLogoPath(db, path, guard.access.userId);
    } catch (err) {
      await removeFile(path);
      throw err;
    }
    await removeFile(previous);
    return NextResponse.json({ success: true, path, url: printLogoUrl(path) });
  } catch (err: unknown) {
    console.error("[api/forms/settings/logo] upload error:", err);
    return NextResponse.json({ error: "Không tải được logo lên." }, { status: 500 });
  }
}

/** Gỡ logo: phiếu in để trống chỗ logo. */
export async function DELETE() {
  try {
    const guard = await requireAdmin();
    if (guard.response) return guard.response;
    const db = createServiceClient();
    const previous = await loadPrintLogoPath(db);
    await savePrintLogoPath(db, null, guard.access.userId);
    await removeFile(previous);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/forms/settings/logo] delete error:", err);
    return NextResponse.json({ error: "Không gỡ được logo." }, { status: 500 });
  }
}
