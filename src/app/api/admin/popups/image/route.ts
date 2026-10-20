import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { POPUP_IMAGE_MAX_BYTES, popupImageUrl } from "@/lib/popups";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_STORAGE } from "@/lib/supabase/tables";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Tải ảnh popup lên Storage; popup chỉ lưu đường dẫn khi bấm Đăng / Lưu. */
export async function POST(request: NextRequest) {
  const guard = await requirePermission(PERMISSIONS.popupsManage);
  if (guard.response) return guard.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vui lòng chọn ảnh." }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF." }, { status: 400 });
  if (file.size > POPUP_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Dung lượng ảnh tối đa là 5MB." }, { status: 400 });
  }

  const path = `popups/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await createServiceClient()
    .storage.from(CDILV_STORAGE.popups)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ path, url: popupImageUrl(path) });
}
