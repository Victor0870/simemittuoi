import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_STORAGE, CDILV_TABLE } from "@/lib/supabase/tables";
import { PRINT_LOGO_KEY, isPrintLogoPath } from "./logo";

export type PrintLogoImage = {
  buffer: Buffer;
  extension: "png" | "jpeg";
  width: number;
  height: number;
};

/** Định dạng + kích thước ảnh đọc từ nội dung file (không tin vào đuôi / MIME do trình duyệt gửi). */
export function readImageInfo(buffer: Buffer): Omit<PrintLogoImage, "buffer"> | null {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47 && buffer.toString("ascii", 12, 16) === "IHDR") {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width && height ? { extension: "png", width, height } : null;
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) return null;
      const marker = buffer[i + 1];
      if (marker === 0xff) {
        i += 1;
        continue;
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = buffer.readUInt16BE(i + 5);
        const width = buffer.readUInt16BE(i + 7);
        return width && height ? { extension: "jpeg", width, height } : null;
      }
      i += 2 + buffer.readUInt16BE(i + 2);
    }
  }
  return null;
}

export async function loadPrintLogoPath(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db
    .from(CDILV_TABLE.appSettings)
    .select("value")
    .eq("key", PRINT_LOGO_KEY)
    .maybeSingle();
  if (error) console.error("[print-logo] load setting error:", error.message);
  const path = (data?.value as { path?: unknown } | undefined)?.path;
  return isPrintLogoPath(path) ? path : null;
}

export async function savePrintLogoPath(db: SupabaseClient, path: string | null, actorId: string): Promise<void> {
  const { error } = await db.from(CDILV_TABLE.appSettings).upsert({
    key: PRINT_LOGO_KEY,
    value: { path },
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Ảnh logo để nhúng vào file Excel; lỗi tải ảnh thì in không logo (không chặn việc in phiếu). */
export async function loadPrintLogoImage(db: SupabaseClient): Promise<PrintLogoImage | null> {
  const path = await loadPrintLogoPath(db);
  if (!path) return null;
  const { data, error } = await db.storage.from(CDILV_STORAGE.printAssets).download(path);
  if (error || !data) {
    console.error("[print-logo] download error:", error?.message);
    return null;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  const info = readImageInfo(buffer);
  return info ? { buffer, ...info } : null;
}
