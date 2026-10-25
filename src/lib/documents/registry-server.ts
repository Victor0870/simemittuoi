import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_STORAGE, CDILV_TABLE } from "@/lib/supabase/tables";
import { isValidDateValue, type FieldValues } from "./compose";
import { loadNames } from "./drafts-server";
import { SCAN_EXT, SCAN_LIMITS, isScanMimeType, type IssuedDocument, type ScanMimeType } from "./registry";
import { isDocumentType } from "./templates";

const COLUMNS =
  "id, template_id, type, title, field_values, status, so_van_ban, ngay_ban_hanh, scan_path, issued_at, issued_by, created_by, cong_khai";

export type DocumentRecord = {
  id: string;
  template_id: string;
  type: string;
  title: string;
  field_values: unknown;
  status: string;
  so_van_ban: string | null;
  ngay_ban_hanh: string | null;
  scan_path: string | null;
  issued_at: string | null;
  issued_by: string | null;
  created_by: string | null;
  cong_khai: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function scanKind(path: string | null): IssuedDocument["scanKind"] {
  if (!path) return null;
  return path.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
}

function mapIssued(row: DocumentRecord, names: Map<string, string>): IssuedDocument {
  return {
    id: row.id,
    templateId: row.template_id,
    type: isDocumentType(row.type) ? row.type : "quyet_dinh",
    title: row.title,
    soVanBan: row.so_van_ban ?? "",
    ngayBanHanh: row.ngay_ban_hanh ?? "",
    scanKind: scanKind(row.scan_path),
    issuedAt: row.issued_at ?? "",
    issuedByName: (row.issued_by && names.get(row.issued_by)) || "",
    createdByName: (row.created_by && names.get(row.created_by)) || "",
    congKhai: row.cong_khai,
  };
}

async function mapIssuedRows(db: SupabaseClient, rows: DocumentRecord[]): Promise<IssuedDocument[]> {
  const names = await loadNames(db, rows.flatMap((r) => [r.issued_by, r.created_by]));
  return rows.map((r) => mapIssued(r, names));
}

export function recordFieldValues(row: DocumentRecord): FieldValues {
  const raw = row.field_values;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
}

/** Văn bản đã ban hành, mới ban hành lên trước. */
export async function loadIssuedDocuments(db: SupabaseClient): Promise<IssuedDocument[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.documents)
    .select(COLUMNS)
    .eq("status", "da_ban_hanh")
    .order("ngay_ban_hanh", { ascending: false })
    .order("issued_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`Không tải được sổ văn bản: ${error.message}`);
  return mapIssuedRows(db, (data ?? []) as DocumentRecord[]);
}

export async function countIssuedDocuments(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from(CDILV_TABLE.documents)
    .select("id", { count: "exact", head: true })
    .eq("status", "da_ban_hanh");
  if (error) throw new Error(`Không tải được sổ văn bản: ${error.message}`);
  return count ?? 0;
}

export async function loadDocumentRecord(db: SupabaseClient, id: string): Promise<DocumentRecord | null> {
  const { data, error } = await db.from(CDILV_TABLE.documents).select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Không tải được văn bản: ${error.message}`);
  return (data as DocumentRecord | null) ?? null;
}

export async function loadIssuedDocument(db: SupabaseClient, id: string): Promise<IssuedDocument | null> {
  const row = await loadDocumentRecord(db, id);
  if (!row || row.status !== "da_ban_hanh") return null;
  return (await mapIssuedRows(db, [row]))[0];
}

/** Phần tạm của bản scan đang tải lên: tmp/<id văn bản>/<id lượt tải>/<thứ tự>. */
export function scanChunkPath(documentId: string, uploadId: string, index: number): string {
  return `tmp/${documentId}/${uploadId}/${index}`;
}

export async function removeScanChunks(db: SupabaseClient, documentId: string, uploadId: string, total: number) {
  const paths = Array.from({ length: total }, (_, i) => scanChunkPath(documentId, uploadId, i));
  await db.storage.from(CDILV_STORAGE.documents).remove(paths);
}

/** Kiểm tra chữ ký đầu tệp khớp loại tệp khai báo. */
function matchesSignature(bytes: Uint8Array, mime: ScanMimeType): boolean {
  const ascii = (from: number, length: number) => String.fromCharCode(...bytes.subarray(from, from + length));
  if (mime === "application/pdf") return ascii(0, 5) === "%PDF-";
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes[0] === 0x89 && ascii(1, 3) === "PNG";
  return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
}

export type ScanUpload = { uploadId: string; total: number; mime: ScanMimeType; size: number };

export function parseScanUpload(raw: Record<string, unknown>): ScanUpload | null {
  const total = Number(raw.total);
  const size = Number(raw.size);
  if (!isUuid(raw.uploadId) || !isScanMimeType(raw.mime)) return null;
  if (!Number.isInteger(total) || total < 1 || total > SCAN_LIMITS.maxChunks) return null;
  if (!Number.isInteger(size) || size < 1 || size > SCAN_LIMITS.maxBytes) return null;
  return { uploadId: raw.uploadId, total, mime: raw.mime, size };
}

/** Ghép các phần đã tải lên thành bản scan hoàn chỉnh, lưu vào đường dẫn chính thức. */
export async function assembleScan(db: SupabaseClient, documentId: string, upload: ScanUpload): Promise<string> {
  const bucket = db.storage.from(CDILV_STORAGE.documents);
  const parts: Uint8Array[] = [];
  const readChunk = async (index: number) => {
    const { data, error } = await bucket.download(scanChunkPath(documentId, upload.uploadId, index));
    if (error || !data) throw new ScanError("Bản scan tải lên chưa đủ, vui lòng chọn lại tệp.");
    return new Uint8Array(await data.arrayBuffer());
  };
  for (let i = 0; i < upload.total; i++) {
    parts.push(await readChunk(i).catch((err) => (err instanceof ScanError ? Promise.reject(err) : readChunk(i))));
  }
  const length = parts.reduce((sum, p) => sum + p.length, 0);
  if (length !== upload.size || length > SCAN_LIMITS.maxBytes) {
    throw new ScanError("Bản scan tải lên không trọn vẹn, vui lòng thử lại.");
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const p of parts) {
    bytes.set(p, offset);
    offset += p.length;
  }
  if (!matchesSignature(bytes, upload.mime)) {
    throw new ScanError("Tệp không đúng định dạng PDF / ảnh đã chọn.");
  }
  const path = `${documentId}/${Date.now()}.${SCAN_EXT[upload.mime]}`;
  const { error } = await bucket.upload(path, bytes, { contentType: upload.mime, upsert: false });
  if (error) throw new Error(`Không lưu được bản scan: ${error.message}`);
  return path;
}

export class ScanError extends Error {}

export type IssueInput = { soVanBan: string; ngayBanHanh: string };

export function parseIssueInput(raw: Record<string, unknown>): { value: IssueInput; error: null } | { value: null; error: string } {
  const soVanBan = typeof raw.soVanBan === "string" ? raw.soVanBan.trim().replace(/\s+/g, " ") : "";
  if (!soVanBan) return { value: null, error: "Vui lòng nhập số văn bản." };
  if (soVanBan.length > SCAN_LIMITS.number) return { value: null, error: "Số văn bản quá dài." };
  const ngayBanHanh = typeof raw.ngayBanHanh === "string" ? raw.ngayBanHanh.trim() : "";
  if (!isValidDateValue(ngayBanHanh)) return { value: null, error: "Ngày ban hành không hợp lệ." };
  return { value: { soVanBan, ngayBanHanh }, error: null };
}

/** Số văn bản đã dùng cho văn bản khác cùng loại, cùng năm ban hành. */
export async function isIssueNumberTaken(db: SupabaseClient, row: DocumentRecord, input: IssueInput): Promise<boolean> {
  const year = input.ngayBanHanh.slice(0, 4);
  const { data, error } = await db
    .from(CDILV_TABLE.documents)
    .select("id, so_van_ban")
    .eq("status", "da_ban_hanh")
    .eq("type", row.type)
    .gte("ngay_ban_hanh", `${year}-01-01`)
    .lte("ngay_ban_hanh", `${year}-12-31`)
    .neq("id", row.id)
    .limit(5000);
  if (error) throw new Error(`Không kiểm tra được số văn bản: ${error.message}`);
  const target = input.soVanBan.toLocaleLowerCase("vi");
  return (data ?? []).some((d) => String(d.so_van_ban ?? "").trim().toLocaleLowerCase("vi") === target);
}

/** Chuyển bản nháp sang đã ban hành. Trả về false nếu văn bản không còn là bản nháp. */
export async function markIssued(
  db: SupabaseClient,
  id: string,
  input: IssueInput,
  scanPath: string,
  actorId: string,
): Promise<{ ok: true } | { ok: false; duplicate: boolean }> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(CDILV_TABLE.documents)
    .update({
      status: "da_ban_hanh",
      so_van_ban: input.soVanBan,
      ngay_ban_hanh: input.ngayBanHanh,
      scan_path: scanPath,
      issued_at: now,
      issued_by: actorId,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "nhap")
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { ok: false, duplicate: true };
    throw new Error(`Không ban hành được văn bản: ${error.message}`);
  }
  return data ? { ok: true } : { ok: false, duplicate: false };
}

/**
 * Hủy ban hành: trả văn bản về bản nháp, xóa số / ngày ban hành / người ban hành, tắt công khai.
 * Bản scan đã ký thuộc lần ban hành bị hủy; route gọi hàm này xóa tệp khỏi kho sau khi cập nhật thành công.
 */
export async function markUnissued(db: SupabaseClient, row: DocumentRecord): Promise<boolean> {
  const { data, error } = await db
    .from(CDILV_TABLE.documents)
    .update({
      status: "nhap",
      so_van_ban: null,
      ngay_ban_hanh: null,
      scan_path: null,
      issued_at: null,
      issued_by: null,
      cong_khai: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "da_ban_hanh")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Không hủy ban hành được: ${error.message}`);
  return Boolean(data);
}

export async function setDocumentPublic(db: SupabaseClient, id: string, congKhai: boolean): Promise<boolean> {
  const { data, error } = await db
    .from(CDILV_TABLE.documents)
    .update({ cong_khai: congKhai, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "da_ban_hanh")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Không lưu được: ${error.message}`);
  return Boolean(data);
}
