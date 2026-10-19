import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import {
  buildChildrenGiftList,
  earliestBirthExclusive,
  type GiftChildItem,
  type GiftChildSource,
  type GiftFilter,
} from "./children-gifts";

/** Con của đoàn viên đã duyệt, dưới filter.maxAge tuổi tại filter.refDate. */
export async function loadChildrenGiftList(db: SupabaseClient, filter: GiftFilter): Promise<GiftChildItem[]> {
  const { data: children, error } = await db
    .from(CDILV_TABLE.memberChildren)
    .select("id, member_id, full_name, date_of_birth, gender")
    .gt("date_of_birth", earliestBirthExclusive(filter.refDate, filter.maxAge))
    .lte("date_of_birth", filter.refDate);
  if (error) throw new Error(`Không tải được danh sách con: ${error.message}`);
  if (!children?.length) return [];

  const memberIds = [...new Set(children.map((c) => c.member_id as string))];
  const { data: parents, error: parentError } = await db
    .from(CDILV_TABLE.profiles)
    .select("id, full_name, employee_code, department")
    .in("id", memberIds)
    .eq("approval_status", "approved");
  if (parentError) throw new Error(`Không tải được thông tin đoàn viên: ${parentError.message}`);

  const parentById = new Map((parents ?? []).map((p) => [p.id as string, p]));
  const sources: GiftChildSource[] = [];
  for (const c of children) {
    const p = parentById.get(c.member_id as string);
    if (!p) continue;
    sources.push({
      childId: c.id as string,
      fullName: c.full_name as string,
      dateOfBirth: c.date_of_birth as string,
      gender: (c.gender as GiftChildSource["gender"]) ?? null,
      parent: {
        memberId: p.id as string,
        fullName: (p.full_name as string) || "(chưa có tên)",
        employeeCode: (p.employee_code as string | null) ?? null,
        department: (p.department as string | null) ?? null,
      },
    });
  }
  return buildChildrenGiftList(sources, filter);
}
