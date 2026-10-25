import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";
import { defaultNumberingSeries, numberingError, type NumberingSeries } from "./numbering";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, isDocumentType, type DocumentType } from "./templates";

type SeriesRow = { doc_type: string; format: string; pad: number; reset_period: string };

/** Cấu hình số của mọi loại văn bản; loại chưa có dòng trong bảng dùng mẫu mặc định. */
export async function loadNumberingSeries(db: SupabaseClient): Promise<NumberingSeries[]> {
  const { data, error } = await db.from(CDILV_TABLE.documentNumberSeries).select("doc_type, format, pad, reset_period");
  if (error) throw new Error(`Không tải được cấu hình số văn bản: ${error.message}`);
  const byType = new Map(((data ?? []) as SeriesRow[]).map((r) => [r.doc_type, r]));
  return defaultNumberingSeries().map((fallback) => {
    const row = byType.get(fallback.type);
    if (!row) return fallback;
    return {
      type: fallback.type,
      format: row.format,
      pad: row.pad,
      reset: row.reset_period === "monthly" ? "monthly" : "yearly",
    };
  });
}

/** Kiểm tra danh sách gửi lên; trả lỗi (kèm tên loại) nếu có dòng không hợp lệ. */
export function parseNumberingInput(raw: unknown): { value: NumberingSeries[]; error: null } | { value: null; error: string } {
  const list = raw && typeof raw === "object" ? (raw as { series?: unknown }).series : null;
  if (!Array.isArray(list)) return { value: null, error: "Dữ liệu không hợp lệ." };
  const byType = new Map<DocumentType, NumberingSeries>();
  for (const item of list) {
    const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (!isDocumentType(entry.type)) continue;
    const series: NumberingSeries = {
      type: entry.type,
      format: typeof entry.format === "string" ? entry.format.trim().replace(/\s+/g, " ") : "",
      pad: Number(entry.pad),
      reset: entry.reset === "monthly" ? "monthly" : "yearly",
    };
    const error = numberingError(series);
    if (error) return { value: null, error: `${DOCUMENT_TYPE_LABEL[series.type]}: ${error}` };
    byType.set(series.type, series);
  }
  if (byType.size === 0) return { value: null, error: "Dữ liệu không hợp lệ." };
  return { value: DOCUMENT_TYPES.filter((t) => byType.has(t)).map((t) => byType.get(t)!), error: null };
}

export async function saveNumberingSeries(db: SupabaseClient, list: NumberingSeries[], actorId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db.from(CDILV_TABLE.documentNumberSeries).upsert(
    list.map((s) => ({
      doc_type: s.type,
      format: s.format,
      pad: s.pad,
      reset_period: s.reset,
      updated_by: actorId,
      updated_at: now,
    })),
    { onConflict: "doc_type" },
  );
  if (error) throw new Error(`Không lưu được cấu hình số văn bản: ${error.message}`);
}

/** Số sẽ được cấp nếu ban hành ngay (không tăng bộ đếm). */
export async function previewDocumentNumber(db: SupabaseClient, type: DocumentType, date: string): Promise<string> {
  const { data, error } = await db.rpc(CDILV_RPC.documentNumberPreview, { p_type: type, p_date: date });
  if (error || typeof data !== "string") throw new Error(`Không xem trước được số văn bản: ${error?.message ?? "không có kết quả"}`);
  return data;
}
