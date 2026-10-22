import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import type { EntryInput, FundEntry } from "./registry";

/**
 * Kiểm tra quỹ / danh mục còn dùng được. Khi sửa, quỹ / danh mục cũ được giữ dù đã ẩn.
 * Khóa sổ, ngày bắt đầu quỹ và loại danh mục còn được kiểm tra lại trong database.
 */
export async function validateEntryRefs(db: SupabaseClient, input: EntryInput, current?: FundEntry | null): Promise<string[]> {
  const errors: string[] = [];
  const fundIds = [input.fundId, input.toFundId].filter((id): id is string => Boolean(id));
  const { data: funds } = await db.from(CDILV_TABLE.funds).select("id, name, is_active").in("id", fundIds);
  const keep = new Set([current?.fund_id, current?.to_fund_id].filter(Boolean));
  for (const id of fundIds) {
    const fund = (funds ?? []).find((f) => f.id === id);
    if (!fund) errors.push("Quỹ không tồn tại.");
    else if (!fund.is_active && !keep.has(id)) errors.push(`Quỹ “${fund.name}” đã ngừng sử dụng.`);
  }
  if (input.categoryId) {
    const { data: category } = await db
      .from(CDILV_TABLE.fundCategories)
      .select("id, kind, name, is_active")
      .eq("id", input.categoryId)
      .maybeSingle();
    if (!category) errors.push("Danh mục không tồn tại.");
    else if (category.kind !== input.kind) errors.push("Danh mục không khớp loại thu / chi.");
    else if (!category.is_active && current?.category_id !== input.categoryId) {
      errors.push(`Danh mục “${category.name}” đã ẩn.`);
    }
  }
  return errors;
}
