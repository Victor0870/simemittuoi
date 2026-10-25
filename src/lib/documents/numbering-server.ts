import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";
import { defaultNumberingSeries, numberingError, type NumberingSeries, type NumberingStatus } from "./numbering";
import { todayInVietnam } from "./registry";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, isDocumentType, type DocumentType } from "./templates";

type SeriesRow = { doc_type: string; format: string; pad: number; reset_period: string };
type StateRow = { period?: string; start?: number; last?: number; next?: string };

export type NumberingConfig = { series: NumberingSeries[]; status: Record<DocumentType, NumberingStatus> };

/**
 * Cấu hình số của mọi loại văn bản (loại chưa có dòng trong bảng dùng mẫu mặc định) kèm trạng thái kỳ đếm hiện tại:
 * số bắt đầu, số đã cấp gần nhất, số tiếp theo (hàm cdilv_document_number_state, không tăng bộ đếm).
 */
export async function loadNumberingConfig(db: SupabaseClient): Promise<NumberingConfig> {
  const [seriesRes, stateRes] = await Promise.all([
    db.from(CDILV_TABLE.documentNumberSeries).select("doc_type, format, pad, reset_period"),
    db.rpc(CDILV_RPC.documentNumberState, { p_types: [...DOCUMENT_TYPES], p_date: todayInVietnam() }),
  ]);
  if (seriesRes.error) throw new Error(`Không tải được cấu hình số văn bản: ${seriesRes.error.message}`);
  if (stateRes.error) throw new Error(`Không tải được trạng thái số văn bản: ${stateRes.error.message}`);
  const byType = new Map(((seriesRes.data ?? []) as SeriesRow[]).map((r) => [r.doc_type, r]));
  const states = (stateRes.data ?? {}) as Record<string, StateRow>;
  const series = defaultNumberingSeries().map((fallback): NumberingSeries => {
    const row = byType.get(fallback.type);
    const start = Number(states[fallback.type]?.start) || 1;
    if (!row) return { ...fallback, start };
    return {
      type: fallback.type,
      format: row.format,
      pad: row.pad,
      reset: row.reset_period === "monthly" ? "monthly" : "yearly",
      start,
    };
  });
  const status = Object.fromEntries(
    DOCUMENT_TYPES.map((type) => {
      const s = states[type] ?? {};
      return [type, { period: s.period ?? "", lastIssued: Number(s.last) || 0, next: s.next ?? "" }];
    }),
  ) as Record<DocumentType, NumberingStatus>;
  return { series, status };
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
      start: Number(entry.start),
    };
    const error = numberingError(series);
    if (error) return { value: null, error: `${DOCUMENT_TYPE_LABEL[series.type]}: ${error}` };
    byType.set(series.type, series);
  }
  if (byType.size === 0) return { value: null, error: "Dữ liệu không hợp lệ." };
  return { value: DOCUMENT_TYPES.filter((t) => byType.has(t)).map((t) => byType.get(t)!), error: null };
}

/**
 * Lưu mẫu số và số bắt đầu cho kỳ đếm hiện tại trong một giao dịch (hàm cdilv_document_number_configure).
 * Số bắt đầu mới không được nhỏ hơn hoặc bằng số đã cấp gần nhất trong kỳ; khi đó không lưu gì.
 */
export async function saveNumberingSeries(
  db: SupabaseClient,
  list: NumberingSeries[],
  actorId: string,
): Promise<{ ok: true } | { ok: false; type: DocumentType; lastIssued: number }> {
  const { data, error } = await db.rpc(CDILV_RPC.documentNumberConfigure, {
    p_series: list,
    p_date: todayInVietnam(),
    p_actor_id: actorId,
  });
  if (error) throw new Error(`Không lưu được cấu hình số văn bản: ${error.message}`);
  const result = (data ?? {}) as { ok?: boolean; type?: string; last?: number };
  if (result.ok) return { ok: true };
  return { ok: false, type: isDocumentType(result.type) ? result.type : list[0].type, lastIssued: Number(result.last) || 0 };
}

/** Số sẽ được cấp nếu ban hành ngay (không tăng bộ đếm). */
export async function previewDocumentNumber(db: SupabaseClient, type: DocumentType, date: string): Promise<string> {
  const { data, error } = await db.rpc(CDILV_RPC.documentNumberPreview, { p_type: type, p_date: date });
  if (error || typeof data !== "string") throw new Error(`Không xem trước được số văn bản: ${error?.message ?? "không có kết quả"}`);
  return data;
}
