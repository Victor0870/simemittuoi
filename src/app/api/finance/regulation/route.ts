import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SPENDING_REGULATION_LIMITS } from "@/lib/finance/regulation";
import { saveSpendingRegulation } from "@/lib/finance/regulation-server";
import { createServiceClient } from "@/lib/supabase/service";

/** Lưu Quy chế chi tiêu. Body: { title, regulationNo, effectiveDate: "YYYY-MM-DD" | null, content }. */
export async function PUT(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.financeManage);
    if (guard.response) return guard.response;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập tên quy chế." }, { status: 400 });
    }
    if (body.title.trim().length > SPENDING_REGULATION_LIMITS.title) {
      return NextResponse.json({ error: "Tên quy chế quá dài." }, { status: 400 });
    }
    if (typeof body.regulationNo === "string" && body.regulationNo.trim().length > SPENDING_REGULATION_LIMITS.regulationNo) {
      return NextResponse.json({ error: "Số quy chế quá dài." }, { status: 400 });
    }
    if (typeof body.content === "string" && body.content.length > SPENDING_REGULATION_LIMITS.content) {
      return NextResponse.json({ error: "Nội dung quá dài (tối đa 200.000 ký tự)." }, { status: 400 });
    }
    if (body.effectiveDate !== null && body.effectiveDate !== undefined && body.effectiveDate !== "") {
      if (typeof body.effectiveDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.effectiveDate)) {
        return NextResponse.json({ error: "Ngày hiệu lực không hợp lệ." }, { status: 400 });
      }
    }

    const saved = await saveSpendingRegulation(createServiceClient(), body, guard.access.userId);
    return NextResponse.json({ success: true, ...saved });
  } catch (err: unknown) {
    console.error("[api/finance/regulation] error:", err);
    return NextResponse.json({ error: "Không lưu được quy chế chi tiêu." }, { status: 500 });
  }
}
