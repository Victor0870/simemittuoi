import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type EmployeeSearchResult = { employeeCode: string; fullName: string; department: string };

const MAX_RESULTS = 8;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Gợi ý nhân viên đang hoạt động (kể cả chưa có tài khoản) theo mã hoặc họ tên. Chỉ trả tên, mã, bộ phận. */
export async function searchEmployees(db: SupabaseClient, rawQuery: string): Promise<EmployeeSearchResult[]> {
  const raw = rawQuery.slice(0, 60);
  const q = fold(raw);
  if (q.length < 1) return [];

  const { data, error } = await db
    .from(CDILV_TABLE.employeeWhitelist)
    .select("employee_code, full_name, department, is_active")
    .range(0, 4999);
  if (error) throw error;

  const qCode = raw.trim().toUpperCase();
  const scored: { score: number; row: EmployeeSearchResult }[] = [];
  for (const r of data ?? []) {
    if (r.is_active === false) continue;
    const code = String(r.employee_code || "").toUpperCase();
    const name = fold(String(r.full_name || ""));
    let score = -1;
    if (code === qCode) score = 0;
    else if (code.startsWith(qCode)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (name.split(" ").some((w) => w.startsWith(q))) score = 3;
    else if (name.includes(q)) score = 4;
    else if (code.includes(qCode)) score = 5;
    if (score < 0) continue;
    scored.push({
      score,
      row: { employeeCode: r.employee_code, fullName: r.full_name || "", department: r.department || "" },
    });
  }

  scored.sort((a, b) => a.score - b.score || a.row.fullName.localeCompare(b.row.fullName, "vi"));
  return scored.slice(0, MAX_RESULTS).map((s) => s.row);
}
