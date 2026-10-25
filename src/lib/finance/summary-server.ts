import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentAccess } from "@/lib/auth/guard";
import type { CategoryKind, Fund, FundCategory, FundEntry } from "@/lib/finance/registry";
import { financeAbilities, loadCategories, loadEntries, loadFunds, loadLockedThrough } from "@/lib/finance/server";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import {
  normalizeStoredOpeningBalances,
  parseSummaryFilter,
  type PeriodOpeningEntry,
  type StoredOpeningBalances,
  type SummaryFilter,
} from "./summary";

export const FINANCE_OPENING_BALANCES_KEY = "finance_opening_balances";

export type SummaryPageSearchParams = {
  periodType?: string;
  year?: string;
  month?: string;
  quarter?: string;
};

export type FinanceSummaryDataset = {
  funds: Fund[];
  categories: FundCategory[];
  entries: FundEntry[];
  entryNotes: Record<string, string>;
  lockedThrough: string | null;
  openingBalances: StoredOpeningBalances;
  unionName: string;
};

export async function loadOpeningBalances(db: SupabaseClient): Promise<StoredOpeningBalances> {
  const { data, error } = await db
    .from(CDILV_TABLE.appSettings)
    .select("value")
    .eq("key", FINANCE_OPENING_BALANCES_KEY)
    .maybeSingle();
  if (error) throw new Error(`Không tải được số dư đầu kỳ: ${error.message}`);
  return normalizeStoredOpeningBalances(data?.value);
}

export async function savePeriodOpeningBalance(
  db: SupabaseClient,
  params: {
    periodKey: string;
    fromDate: string;
    amount: number | null;
    note: string | null;
    actorId: string;
  },
): Promise<StoredOpeningBalances> {
  const current = await loadOpeningBalances(db);
  const nextPeriods: Record<string, PeriodOpeningEntry> = { ...current.periods };
  const now = new Date().toISOString();

  if (params.amount === null) {
    delete nextPeriods[params.periodKey];
  } else {
    nextPeriods[params.periodKey] = {
      periodKey: params.periodKey,
      fromDate: params.fromDate,
      amount: Math.round(params.amount),
      note: params.note?.trim() ? params.note.trim() : null,
      updatedAt: now,
    };
  }

  const nextValue: StoredOpeningBalances = { periods: nextPeriods };
  const { error } = await db.from(CDILV_TABLE.appSettings).upsert({
    key: FINANCE_OPENING_BALANCES_KEY,
    value: nextValue,
    updated_by: params.actorId,
    updated_at: now,
  });
  if (error) throw new Error(`Không lưu được số dư đầu kỳ: ${error.message}`);
  return nextValue;
}

export async function loadEntryNotes(db: SupabaseClient): Promise<Record<string, string>> {
  const notes: Record<string, string> = {};
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from(CDILV_TABLE.fundEntryLogs)
      .select("entry_id, action, note, created_at")
      .not("note", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Không tải được ghi chú sổ quỹ: ${error.message}`);
    for (const row of data ?? []) {
      const entryId = row.entry_id as string;
      const action = row.action as string;
      const note = typeof row.note === "string" ? row.note.trim() : "";
      if (!note || action === "voided") continue;
      notes[entryId] = note;
    }
    if (!data || data.length < pageSize) break;
  }
  return notes;
}

export async function loadFinanceSummaryDataset(db: SupabaseClient): Promise<FinanceSummaryDataset> {
  const [funds, categories, entries, entryNotes, lockedThrough, openingBalances, formSettings] = await Promise.all([
    loadFunds(db),
    loadCategories(db),
    loadEntries(db),
    loadEntryNotes(db),
    loadLockedThrough(db),
    loadOpeningBalances(db),
    loadFormSettings(db),
  ]);

  return {
    funds,
    categories,
    entries,
    entryNotes,
    lockedThrough,
    openingBalances,
    unionName: formSettings.unionName,
  };
}

export async function prepareFinanceSummaryPage(
  kind: CategoryKind,
  searchParams: Promise<SummaryPageSearchParams>,
): Promise<{
  canWrite: boolean;
  dataset: FinanceSummaryDataset;
  initialFilter: SummaryFilter;
  today: string;
}> {
  const params = await searchParams;
  const access = await getCurrentAccess();
  const nextPath = kind === "income" ? "/admin/finance/income" : "/admin/finance/expense";
  if (!access) redirect(`/login?next=${nextPath}`);

  const can = financeAbilities(access);
  if (!can.view && !can.record && !can.manage) redirect("/");

  const today = todayInVietnam();
  const initialFilter = parseSummaryFilter(params, today);
  const db = createServiceClient();
  const dataset = await loadFinanceSummaryDataset(db);

  return {
    canWrite: can.record || can.manage,
    dataset,
    initialFilter,
    today,
  };
}
