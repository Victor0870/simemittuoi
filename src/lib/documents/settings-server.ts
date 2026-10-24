import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { DOCUMENT_SETTINGS_KEY, normalizeDocumentOrgSettings, type DocumentOrgSettings } from "./settings";

export async function loadDocumentOrgSettings(db: SupabaseClient): Promise<DocumentOrgSettings> {
  const { data, error } = await db
    .from(CDILV_TABLE.appSettings)
    .select("value")
    .eq("key", DOCUMENT_SETTINGS_KEY)
    .maybeSingle();
  if (error) console.error("[documents] load settings error:", error.message);
  return normalizeDocumentOrgSettings(data?.value);
}

export async function saveDocumentOrgSettings(
  db: SupabaseClient,
  raw: unknown,
  actorId: string,
): Promise<DocumentOrgSettings> {
  const value = normalizeDocumentOrgSettings(raw);
  const { error } = await db.from(CDILV_TABLE.appSettings).upsert({
    key: DOCUMENT_SETTINGS_KEY,
    value,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Không lưu được cài đặt văn bản: ${error.message}`);
  return value;
}
