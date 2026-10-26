import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { deleteUnionOfficer, updateUnionOfficer } from "@/lib/union-settings/server";
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
        { error: "Bạn chưa được phân quyền cập nhật cán bộ công đoàn." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const officer = await updateUnionOfficer(createServiceClient(), id, body, access.userId);
    return NextResponse.json({ officer });
  } catch (err: unknown) {
    console.error("[api/union-settings/officers/[id]] PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Không cập nhật được thông tin cán bộ." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await getCurrentAccess();
    if (!access) {
      return NextResponse.json({ error: "Vui lòng đăng nhập tài khoản." }, { status: 401 });
    }
    if (!canManageUnionSettings(access)) {
      return NextResponse.json(
        { error: "Bạn chưa được phân quyền xóa cán bộ công đoàn." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    await deleteUnionOfficer(createServiceClient(), id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/union-settings/officers/[id]] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Không xóa được cán bộ công đoàn." },
      { status: 400 },
    );
  }
}
