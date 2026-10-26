import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { createUnionPosition, loadUnionPositions } from "@/lib/union-settings/server";
import { canManageUnionSettings } from "@/lib/union-settings/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await getCurrentAccess();
    if (!access) {
      return NextResponse.json({ error: "Vui lòng đăng nhập tài khoản." }, { status: 401 });
    }
    if (!canManageUnionSettings(access)) {
      return NextResponse.json(
        { error: "Bạn chưa được phân quyền quản lý chức danh công đoàn." },
        { status: 403 },
      );
    }
    const positions = await loadUnionPositions(createServiceClient());
    return NextResponse.json({ positions });
  } catch (err: unknown) {
    console.error("[api/union-settings/positions] GET error:", err);
    return NextResponse.json({ error: "Không tải được danh mục chức danh." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getCurrentAccess();
    if (!access) {
      return NextResponse.json({ error: "Vui lòng đăng nhập tài khoản." }, { status: 401 });
    }
    if (!canManageUnionSettings(access)) {
      return NextResponse.json(
        { error: "Bạn chưa được phân quyền thêm chức danh công đoàn." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const position = await createUnionPosition(createServiceClient(), body, access.userId);
    return NextResponse.json({ position });
  } catch (err: unknown) {
    console.error("[api/union-settings/positions] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Không thêm được chức danh công đoàn." },
      { status: 400 },
    );
  }
}
