import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { createUnionOfficer, loadUnionOfficers } from "@/lib/union-settings/server";
import {
  canManageUnionSettings,
  canReadUnionOfficers,
  toOfficerSuggestion,
} from "@/lib/union-settings/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await getCurrentAccess();
    if (!access) {
      return NextResponse.json({ error: "Vui lòng đăng nhập tài khoản." }, { status: 401 });
    }
    if (!canReadUnionOfficers(access)) {
      return NextResponse.json(
        { error: "Bạn chưa được phân quyền xem danh sách cán bộ công đoàn." },
        { status: 403 },
      );
    }

    if (!canManageUnionSettings(access)) {
      const officers = await loadUnionOfficers(createServiceClient(), { activeOnly: true });
      return NextResponse.json({
        officers: officers.filter((o) => o.isActive && o.positionIsActive).map(toOfficerSuggestion),
      });
    }

    const activeOnly = request.nextUrl.searchParams.get("activeOnly") === "1";
    const officers = await loadUnionOfficers(createServiceClient(), { activeOnly });
    return NextResponse.json({ officers });
  } catch (err: unknown) {
    console.error("[api/union-settings/officers] GET error:", err);
    return NextResponse.json(
      { error: "Không tải được danh sách cán bộ công đoàn." },
      { status: 500 },
    );
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
        { error: "Bạn chưa được phân quyền thêm cán bộ công đoàn." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const officer = await createUnionOfficer(createServiceClient(), body, access.userId);
    return NextResponse.json({ officer });
  } catch (err: unknown) {
    console.error("[api/union-settings/officers] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Không thêm được cán bộ công đoàn." },
      { status: 400 },
    );
  }
}
