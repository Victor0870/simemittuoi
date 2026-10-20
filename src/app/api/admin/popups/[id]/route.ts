import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { parsePopupInput, popupInputToRow } from "@/lib/popups";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

type Params = { params: Promise<{ id: string }> };

/** Sửa toàn bộ popup, hoặc chỉ bật / tắt khi body là { isActive }. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requirePermission(PERMISSIONS.popupsManage);
  if (guard.response) return guard.response;

  const { id } = await params;
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const toggleOnly = raw && Object.keys(raw).length === 1 && typeof raw.isActive === "boolean";

  let update: Record<string, unknown>;
  if (toggleOnly) {
    update = { is_active: raw.isActive };
  } else {
    const parsed = parsePopupInput(raw);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    update = popupInputToRow(parsed.value);
  }

  const { data, error } = await createServiceClient()
    .from(CDILV_TABLE.popups)
    .update({ ...update, updated_by: guard.access.userId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Không tìm thấy popup." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const guard = await requirePermission(PERMISSIONS.popupsManage);
  if (guard.response) return guard.response;

  const { id } = await params;
  const { error } = await createServiceClient().from(CDILV_TABLE.popups).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
