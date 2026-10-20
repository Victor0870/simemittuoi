import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";

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

/** Gợi ý nhân viên (kể cả chưa có tài khoản) khi nhập thành viên tác phẩm. Chỉ trả tên, mã, bộ phận. */
export async function GET(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.pollsManage);
    if (guard.response) return guard.response;

    const raw = (request.nextUrl.searchParams.get("q") || "").slice(0, 60);
    const q = fold(raw);
    if (q.length < 1) return NextResponse.json({ results: [] });

    const db = createServiceClient();
    const { data, error } = await db
      .from(CDILV_TABLE.employeeWhitelist)
      .select("employee_code, full_name, department, is_active")
      .range(0, 4999);
    if (error) throw error;

    const qCode = raw.trim().toUpperCase();
    const scored: { score: number; row: { employeeCode: string; fullName: string; department: string } }[] = [];
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
    return NextResponse.json({ results: scored.slice(0, MAX_RESULTS).map((s) => s.row) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi tìm nhân viên.";
    console.error("[api/polls/employee-search]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
