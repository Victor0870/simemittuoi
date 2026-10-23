import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import type { Counterparty } from "./registry";

const COUNTERPARTY_COLUMNS = "id, code, kind, name, address, tax_code, bank_account_no, bank_name, is_active";

/** Danh mục đối tượng, sắp theo tên. activeOnly: chỉ đối tượng đang dùng (+ includeIds dù đã ẩn). */
export async function loadCounterparties(
  db: SupabaseClient,
  options: { activeOnly?: boolean; includeIds?: (string | null | undefined)[] } = {},
): Promise<Counterparty[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.counterparties)
    .select(COUNTERPARTY_COLUMNS)
    .order("name", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`Không tải được danh mục đối tượng: ${error.message}`);
  const rows = (data ?? []) as Counterparty[];
  if (!options.activeOnly) return rows;
  const keep = new Set(options.includeIds?.filter(Boolean));
  return rows.filter((c) => c.is_active || keep.has(c.id));
}

export async function loadCounterparty(db: SupabaseClient, id: string): Promise<Counterparty | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from(CDILV_TABLE.counterparties).select(COUNTERPARTY_COLUMNS).eq("id", id).maybeSingle();
  return (data as Counterparty | null) ?? null;
}

/** Kiểm tra đối tượng gắn vào chứng từ: phải tồn tại và đang dùng (trừ khi giữ nguyên đối tượng cũ). */
export async function validateCounterpartyLink(
  db: SupabaseClient,
  id: string | null,
  keepId?: string | null,
): Promise<string | null> {
  if (!id || id === keepId) return null;
  const c = await loadCounterparty(db, id);
  if (!c) return "Đối tượng đã chọn không còn trong danh mục.";
  if (!c.is_active) return `Đối tượng ${c.code} – ${c.name} đã ngừng sử dụng.`;
  return null;
}
