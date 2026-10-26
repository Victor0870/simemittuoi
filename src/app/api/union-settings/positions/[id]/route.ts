import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { updateUnionPosition } from "@/lib/union-settings/server";
import { canManageUnionSettings } from "@/lib/union-settings/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await getCurrentAccess();
    if (!access) {
      return NextResponse.json({ error: "Vui lòng đăng nhập tài khoản." }, { status: 401 });
    }
    if (!canManageUnionSettings(access)) {
      return NextResponse.json(
        { error: "Bạn chưa được phân quyền sửa chức danh công đoàn." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const position = await updateUnionPosition(createServiceClient(), id, body, access.userId);
    return NextResponse.json({ position });
  } catch (err: unknown) {
    console.error("[api/union-settings/positions/[id]] PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Không cập nhật được chức danh công đoàn." },
      { status: 400 },
    );
  }
}
