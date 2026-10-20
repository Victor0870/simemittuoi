import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { parsePopupInput, popupInputToRow } from "@/lib/popups";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function POST(request: NextRequest) {
  const guard = await requirePermission(PERMISSIONS.popupsManage);
  if (guard.response) return guard.response;

  const parsed = parsePopupInput(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await createServiceClient()
    .from(CDILV_TABLE.popups)
    .insert({
      ...popupInputToRow(parsed.value),
      created_by: guard.access.userId,
      updated_by: guard.access.userId,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
