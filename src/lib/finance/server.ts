import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { loadNames } from "@/lib/visits/server";
import type { Fund, FundCategory, FundEntry } from "./registry";

const FUND_COLUMNS = "id, kind, name, bank_account_no, bank_name, opening_balance, opening_date, is_active, sort_order";
const CATEGORY_COLUMNS = "id, kind, code, name, system_key, sort_order, is_active";
const ENTRY_COLUMNS =
  "id, code, entry_date, kind, fund_id, to_fund_id, category_id, amount, description, counterparty, document_no, payment_request_id, status, void_reason, created_at";

export const FUND_SETTINGS_KEY = "fund";

export type FinanceAbilities = {
  view: boolean;
  record: boolean;
  manage: boolean;
};

export type FundEntryLog = {
  id: string;
  action: string;
  note: string | null;
  created_at: string;
  actor_name: string | null;
};

export type FundEntryDetail = FundEntry & {
  creator_name: string | null;
  voider_name: string | null;
  voided_at: string | null;
  payment_code: string | null;
  logs: FundEntryLog[];
};

export function financeAbilities(access: CurrentAccess): FinanceAbilities {
  return {
    view: hasPermission(access, PERMISSIONS.financeView),
    record: hasPermission(access, PERMISSIONS.financeRecord),
    manage: hasPermission(access, PERMISSIONS.financeManage),
  };
}

export async function loadFunds(db: SupabaseClient): Promise<Fund[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.funds)
    .select(FUND_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Không tải được danh sách quỹ: ${error.message}`);
  return ((data ?? []) as Fund[]).map((f) => ({ ...f, opening_balance: Number(f.opening_balance) }));
}

export async function loadCategories(db: SupabaseClient): Promise<FundCategory[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.fundCategories)
    .select(CATEGORY_COLUMNS)
    .order("kind", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`Không tải được danh mục thu chi: ${error.message}`);
  return (data ?? []) as FundCategory[];
}

/** Toàn bộ bút toán (kể cả đã hủy) – sổ của một công đoàn cơ sở chỉ vài trăm dòng / năm. */
export async function loadEntries(db: SupabaseClient): Promise<FundEntry[]> {
  const rows: FundEntry[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from(CDILV_TABLE.fundEntries)
      .select(ENTRY_COLUMNS)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Không tải được sổ quỹ: ${error.message}`);
    rows.push(...((data ?? []) as FundEntry[]).map((e) => ({ ...e, amount: Number(e.amount) })));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function loadLockedThrough(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from(CDILV_TABLE.appSettings).select("value").eq("key", FUND_SETTINGS_KEY).maybeSingle();
  const value = (data?.value as { lockedThrough?: unknown } | undefined)?.lockedThrough;
  return typeof value === "string" && value ? value : null;
}

export async function loadEntryRow(db: SupabaseClient, id: string): Promise<FundEntry | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from(CDILV_TABLE.fundEntries).select(ENTRY_COLUMNS).eq("id", id).maybeSingle();
  return data ? ({ ...data, amount: Number(data.amount) } as FundEntry) : null;
}

export async function loadEntryDetail(db: SupabaseClient, id: string): Promise<FundEntryDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db
    .from(CDILV_TABLE.fundEntries)
    .select(`${ENTRY_COLUMNS}, created_by, voided_by, voided_at`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as FundEntry & { created_by: string | null; voided_by: string | null; voided_at: string | null };
  const [{ data: logs }, payment] = await Promise.all([
    db
      .from(CDILV_TABLE.fundEntryLogs)
      .select("id, actor_id, action, note, created_at")
      .eq("entry_id", id)
      .order("created_at", { ascending: true }),
    row.payment_request_id
      ? db.from(CDILV_TABLE.paymentRequests).select("code").eq("id", row.payment_request_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const names = await loadNames(db, [row.created_by, row.voided_by, ...(logs ?? []).map((l) => l.actor_id as string | null)]);
  const name = (uid: string | null) => (uid ? (names.get(uid) ?? null) : null);
  return {
    ...row,
    amount: Number(row.amount),
    creator_name: name(row.created_by),
    voider_name: name(row.voided_by),
    payment_code: (payment.data?.code as string | undefined) ?? null,
    logs: (logs ?? []).map((l) => ({
      id: l.id,
      action: l.action,
      note: l.note,
      created_at: l.created_at,
      actor_name: name(l.actor_id),
    })),
  };
}
