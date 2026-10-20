import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { parsePopupInput, popupInputToRow } from "@/lib/popups";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_STORAGE, CDILV_TABLE } from "@/lib/supabase/tables";

type Params = { params: Promise<{ id: string }> };

/** Sửa toàn bộ popup, hoặc chỉ bật / tắt khi body là { isActive }. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requirePermission(PERMISSIONS.popupsManage);
  if (guard.response) return guard.response;

  const { id } = await params;
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const toggleOnly = raw && Object.keys(raw).length === 1 && typeof raw.isActive === "boolean";

  const db = createServiceClient();
  const { data: current } = await db.from(CDILV_TABLE.popups).select("image_path").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Không tìm thấy popup." }, { status: 404 });

  let update: Record<string, unknown>;
  if (toggleOnly) {
    update = { is_active: raw.isActive };
  } else {
    const parsed = parsePopupInput(raw);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    update = popupInputToRow(parsed.value);
  }

  const { error } = await db
    .from(CDILV_TABLE.popups)
    .update({ ...update, updated_by: guard.access.userId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!toggleOnly && current.image_path && current.image_path !== update.image_path) {
    await db.storage.from(CDILV_STORAGE.popups).remove([current.image_path]);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const guard = await requirePermission(PERMISSIONS.popupsManage);
  if (guard.response) return guard.response;

  const { id } = await params;
  const db = createServiceClient();
  const { data: removed, error } = await db
    .from(CDILV_TABLE.popups)
    .delete()
    .eq("id", id)
    .select("image_path")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (removed?.image_path) {
    await db.storage.from(CDILV_STORAGE.popups).remove([removed.image_path]);
  }
  return NextResponse.json({ ok: true });
}
