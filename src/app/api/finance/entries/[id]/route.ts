import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { entryRpcData, formatVndPlain, parseEntryInput } from "@/lib/finance/registry";
import { loadEntryRow } from "@/lib/finance/server";
import { validateEntryRefs } from "@/lib/finance/validate-server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC } from "@/lib/supabase/tables";

type Params = { params: Promise<{ id: string }> };

/** Sửa bút toán (kỳ chưa khóa, chưa hủy). Không đổi được loại bút toán. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = await requirePermission(PERMISSIONS.financeRecord);
    if (guard.response) return guard.response;

    const db = createServiceClient();
    const current = await loadEntryRow(db, id);
    if (!current) return NextResponse.json({ error: "Không tìm thấy bút toán." }, { status: 404 });
    if (current.status !== "posted") return NextResponse.json({ error: "Bút toán đã hủy, không sửa được." }, { status: 409 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseEntryInput({ ...body, kind: current.kind });
    if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(" ") }, { status: 400 });
    const v = parsed.value;

    const refErrors = await validateEntryRefs(db, v, current);
    if (refErrors.length) return NextResponse.json({ error: refErrors.join(" ") }, { status: 400 });

    const changes: string[] = [];
    if (v.entryDate !== current.entry_date) changes.push(`Ngày: ${current.entry_date} → ${v.entryDate}`);
    if (v.amount !== current.amount) {
      changes.push(`Số tiền: ${formatVndPlain(current.amount)} → ${formatVndPlain(v.amount)}`);
    }
    if (v.fundId !== current.fund_id || v.toFundId !== current.to_fund_id) changes.push("Quỹ");
    if (v.categoryId !== current.category_id) changes.push("Danh mục");
    if (v.description !== current.description) changes.push(`Diễn giải: ${v.description}`);
    if (v.counterparty !== current.counterparty) changes.push("Người nộp / nhận");
    if (v.documentNo !== current.document_no) changes.push("Số chứng từ");
    if (!changes.length) return NextResponse.json({ success: true });

    const { error } = await db.rpc(CDILV_RPC.fundEntrySave, {
      p_entry_id: id,
      p_actor_id: guard.access.userId,
      p_data: entryRpcData(v),
      p_note: changes.join("; ").slice(0, 1000),
    });
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/finance/entries/[id]] update error:", err);
    return NextResponse.json({ error: "Không sửa được bút toán." }, { status: 500 });
  }
}
