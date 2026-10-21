import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { searchEmployees } from "@/lib/employees/search";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Chọn đoàn viên được thăm hỏi khi lập đề nghị. Chỉ trả tên, mã, bộ phận. */
export async function GET(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.visitsCreate);
    if (guard.response) return guard.response;
    const results = await searchEmployees(createServiceClient(), request.nextUrl.searchParams.get("q") || "");
    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi tìm nhân viên.";
    console.error("[api/visits/employee-search]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
