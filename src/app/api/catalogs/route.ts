import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { parseCounterpartyInput } from "@/lib/catalogs/registry";
import { FINANCE_LIMITS } from "@/lib/finance/registry";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Quản lý danh mục. Body:
 *  { action: "saveCategory", category: { id?, kind, code, name, isActive, sortOrder } }
 *  { action: "saveCounterparty", counterparty: { id?, code, kind, name, address, taxCode, bankAccountNo, bankName, isActive } }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.catalogsManage);
    if (guard.response) return guard.response;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = createServiceClient();
    const now = new Date().toISOString();

    if (body.action === "saveCategory") {
      const raw = (body.category ?? {}) as Record<string, unknown>;
      const id = typeof raw.id === "string" && UUID_RE.test(raw.id) ? raw.id : null;
      const name = text(raw.name);
      const code = text(raw.code) || null;
      const sortOrder = Math.round(Number(raw.sortOrder ?? 0)) || 0;
      const isActive = raw.isActive !== false;
      if (!name || name.length > FINANCE_LIMITS.categoryName) return bad("Tên danh mục không hợp lệ.");
      if ((code?.length ?? 0) > FINANCE_LIMITS.categoryCode) return bad("Mã danh mục tối đa 20 ký tự.");

      if (id) {
        const { data: current } = await db.from(CDILV_TABLE.fundCategories).select("system_key").eq("id", id).maybeSingle();
        if (!current) return bad("Không tìm thấy danh mục.", 404);
        if (current.system_key === "payment_default" && !isActive) {
          return bad("Danh mục này dùng khi tự ghi sổ đề nghị thanh toán nên không ẩn được (có thể đổi tên).");
        }
        const { error } = await db
          .from(CDILV_TABLE.fundCategories)
          .update({ name, code, sort_order: sortOrder, is_active: isActive, updated_at: now })
          .eq("id", id);
        if (error) throw error;
      } else {
        const kind = raw.kind === "income" ? "income" : raw.kind === "expense" ? "expense" : null;
        if (!kind) return bad("Loại danh mục không hợp lệ.");
        const { error } = await db
          .from(CDILV_TABLE.fundCategories)
          .insert({ kind, name, code, sort_order: sortOrder, is_active: isActive });
        if (error) throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === "saveCounterparty") {
      const raw = (body.counterparty ?? {}) as Record<string, unknown>;
      const id = typeof raw.id === "string" && UUID_RE.test(raw.id) ? raw.id : null;
      const parsed = parseCounterpartyInput(raw);
      if (!parsed.ok) return bad(parsed.errors.join(" "));
      const v = parsed.value;
      if (id && !v.code) return bad("Vui lòng nhập mã số đối tượng.");

      if (v.code) {
        let dup = db.from(CDILV_TABLE.counterparties).select("id, name").ilike("code", v.code.replace(/[%_\\]/g, "\\$&"));
        if (id) dup = dup.neq("id", id);
        const { data: same } = await dup.limit(1);
        if (same?.length) return bad(`Mã số ${v.code} đã dùng cho “${same[0].name}”.`, 409);
      }

      const row = {
        kind: v.kind,
        name: v.name,
        address: v.address,
        tax_code: v.taxCode,
        bank_account_no: v.bankAccountNo,
        bank_name: v.bankName,
        is_active: v.isActive,
        updated_by: guard.access.userId,
        updated_at: now,
      };
      const { data, error } = id
        ? await db
            .from(CDILV_TABLE.counterparties)
            .update({ ...row, code: v.code })
            .eq("id", id)
            .select("id, code")
            .maybeSingle()
        : await db
            .from(CDILV_TABLE.counterparties)
            .insert({ ...row, code: v.code ?? "", created_by: guard.access.userId })
            .select("id, code")
            .single();
      if (error) {
        if (error.code === "23505") return bad(`Mã số ${v.code ?? ""} đã được dùng.`, 409);
        throw error;
      }
      if (!data) return bad("Không tìm thấy đối tượng.", 404);
      return NextResponse.json({ success: true, id: data.id, code: data.code });
    }

    return bad("Thao tác không hợp lệ.");
  } catch (err: unknown) {
    console.error("[api/catalogs] error:", err);
    return NextResponse.json({ error: "Không lưu được danh mục." }, { status: 500 });
  }
}
