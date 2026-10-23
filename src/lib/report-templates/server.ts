import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { PRIMARY_TEMPLATE_CODE, type ReportTemplate, type TemplateLine, type TemplateVersion } from "./registry";

const VERSION_COLUMNS = "id, template_id, version, status, title, note, effective_from, published_at";
const LINE_COLUMNS = "version_id, side, code, label, line_type, parent_code, sum_codes, sort_order";

type VersionRow = Omit<TemplateVersion, "lines"> & { template_id: string };
type LineRow = TemplateLine & { version_id: string };

export async function loadReportTemplate(db: SupabaseClient, code = PRIMARY_TEMPLATE_CODE): Promise<ReportTemplate | null> {
  const { data: template, error } = await db
    .from(CDILV_TABLE.reportTemplates)
    .select("id, code, name, description")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(`Không tải được mẫu báo cáo: ${error.message}`);
  if (!template) return null;

  const { data: versions, error: vErr } = await db
    .from(CDILV_TABLE.reportTemplateVersions)
    .select(VERSION_COLUMNS)
    .eq("template_id", template.id)
    .order("version", { ascending: false });
  if (vErr) throw new Error(`Không tải được phiên bản mẫu báo cáo: ${vErr.message}`);
  const rows = (versions ?? []) as VersionRow[];
  const active = rows.find((v) => v.status === "active") ?? null;
  const draft = rows.find((v) => v.status === "draft") ?? null;

  const ids = [active?.id, draft?.id].filter((x): x is string => Boolean(x));
  const { data: lineRows, error: lErr } = ids.length
    ? await db.from(CDILV_TABLE.reportTemplateLines).select(LINE_COLUMNS).in("version_id", ids).order("sort_order")
    : { data: [], error: null };
  if (lErr) throw new Error(`Không tải được dòng mẫu báo cáo: ${lErr.message}`);
  const linesOf = (versionId: string): TemplateLine[] =>
    ((lineRows ?? []) as LineRow[])
      .filter((l) => l.version_id === versionId)
      .map(({ version_id: _v, ...l }) => ({ ...l, sum_codes: l.sum_codes ?? [] }));
  const withLines = (v: VersionRow | null): TemplateVersion | null => {
    if (!v) return null;
    const { template_id: _t, ...rest } = v;
    return { ...rest, lines: linesOf(v.id) };
  };

  return {
    id: template.id as string,
    code: template.code as string,
    name: template.name as string,
    description: (template.description as string | null) ?? null,
    active: withLines(active),
    draft: withLines(draft),
    history: rows.map(({ template_id: _t, ...v }) => v),
  };
}

/** Dòng của phiên bản đang áp dụng (rỗng nếu chưa có mẫu). */
export async function loadActiveTemplateLines(db: SupabaseClient, code = PRIMARY_TEMPLATE_CODE): Promise<TemplateLine[]> {
  const template = await loadReportTemplate(db, code);
  return template?.active?.lines ?? [];
}
