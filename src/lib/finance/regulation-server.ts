import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import {
  SPENDING_REGULATION_KEY,
  normalizeSpendingRegulation,
  type SpendingRegulation,
} from "./regulation";

export type StoredSpendingRegulation = {
  regulation: SpendingRegulation;
  updatedAt: string | null;
};

export async function loadSpendingRegulation(db: SupabaseClient): Promise<StoredSpendingRegulation> {
  const { data, error } = await db
    .from(CDILV_TABLE.appSettings)
    .select("value, updated_at")
    .eq("key", SPENDING_REGULATION_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    regulation: normalizeSpendingRegulation(data?.value),
    updatedAt: (data?.updated_at as string | undefined) ?? null,
  };
}

export async function saveSpendingRegulation(
  db: SupabaseClient,
  raw: unknown,
  actorId: string,
): Promise<StoredSpendingRegulation> {
  const regulation = normalizeSpendingRegulation(raw);
  const updatedAt = new Date().toISOString();
  const { error } = await db.from(CDILV_TABLE.appSettings).upsert({
    key: SPENDING_REGULATION_KEY,
    value: regulation,
    updated_by: actorId,
    updated_at: updatedAt,
  });
  if (error) throw new Error(error.message);
  return { regulation, updatedAt };
}
