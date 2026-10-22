import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { entryRpcData, parseEntryInput } from "@/lib/finance/registry";
import { validateEntryRefs } from "@/lib/finance/validate-server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";

/** Ghi phiếu thu / phiếu chi / chuyển quỹ. Body: EntryInput. */
export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.financeRecord);
    if (guard.response) return guard.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseEntryInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(" ") }, { status: 400 });

    const db = createServiceClient();
    const refErrors = await validateEntryRefs(db, parsed.value);
    if (refErrors.length) return NextResponse.json({ error: refErrors.join(" ") }, { status: 400 });

    const { data, error } = await db
      .rpc(CDILV_RPC.fundEntrySave, {
        p_entry_id: null,
        p_actor_id: guard.access.userId,
        p_data: entryRpcData(parsed.value),
        p_note: null,
      })
      .single<{ id: string; code: string }>();
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true, id: data.id, code: data.code });
  } catch (err: unknown) {
    console.error("[api/finance/entries] create error:", err);
    return NextResponse.json({ error: "Không ghi được bút toán." }, { status: 500 });
  }
}
