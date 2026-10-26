/**
 * Logo in ở góc trái Giấy đề nghị thanh toán (ô A1 của mẫu). Ảnh nằm trong bucket công khai
 * cdilv-print-assets, đường dẫn lưu ở cdilv_app_settings (key = PRINT_LOGO_KEY). Chưa có logo = để trống.
 */
import { CDILV_STORAGE } from "@/lib/supabase/tables";

export const PRINT_LOGO_KEY = "print_logo";
export const PRINT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
/** Chỉ PNG / JPG – định dạng file Excel nhúng được. */
export const PRINT_LOGO_TYPES: Record<string, "png" | "jpg"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};
const PATH_PATTERN = /^logo\/[A-Za-z0-9_.-]+\.(png|jpg)$/;

export function isPrintLogoPath(value: unknown): value is string {
  return typeof value === "string" && PATH_PATTERN.test(value);
}

/** Link công khai của logo trong Storage. */
export function printLogoUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${CDILV_STORAGE.printAssets}/${path}`;
}
