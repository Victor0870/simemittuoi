import { NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { createServiceClient } from "@/lib/supabase/service";
import {
  loadAssignableUnionMembers,
  loadUnionOfficers,
  loadUnionPositions,
} from "@/lib/union-settings/server";
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
        { error: "Bạn chưa được phân quyền quản lý cài đặt công đoàn." },
        { status: 403 },
      );
    }

    const db = createServiceClient();
    const [positions, officers, members] = await Promise.all([
      loadUnionPositions(db),
      loadUnionOfficers(db),
      loadAssignableUnionMembers(db),
    ]);

    return NextResponse.json({ positions, officers, members });
  } catch (err: unknown) {
    console.error("[api/union-settings] GET error:", err);
    return NextResponse.json(
      { error: "Không tải được dữ liệu cài đặt công đoàn." },
      { status: 500 },
    );
  }
}
