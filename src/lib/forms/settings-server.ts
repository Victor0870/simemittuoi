import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { FORM_SETTINGS_KEY, normalizeFormSettings, type FormSettings } from "./settings";

export async function loadFormSettings(db: SupabaseClient): Promise<FormSettings> {
  const { data, error } = await db
    .from(CDILV_TABLE.appSettings)
    .select("value")
    .eq("key", FORM_SETTINGS_KEY)
    .maybeSingle();
  if (error) console.error("[forms] load settings error:", error.message);
  return normalizeFormSettings(data?.value);
}

export async function saveFormSettings(db: SupabaseClient, raw: unknown, actorId: string): Promise<FormSettings> {
  const value = normalizeFormSettings(raw);
  const { error } = await db.from(CDILV_TABLE.appSettings).upsert({
    key: FORM_SETTINGS_KEY,
    value,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return value;
}
