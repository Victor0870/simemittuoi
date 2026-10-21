import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { saveFormSettings } from "@/lib/forms/settings-server";
import { createServiceClient } from "@/lib/supabase/service";

/** Lưu cài đặt biểu mẫu in (tên đơn vị, người ký, mức chi thăm hỏi mặc định). */
export async function PUT(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.formsSettings);
    if (guard.response) return guard.response;
    const body = await request.json().catch(() => ({}));
    const settings = await saveFormSettings(createServiceClient(), body, guard.access.userId);
    return NextResponse.json({ success: true, settings });
  } catch (err: unknown) {
    console.error("[api/forms/settings] error:", err);
    return NextResponse.json({ error: "Không lưu được cài đặt." }, { status: 500 });
  }
}
