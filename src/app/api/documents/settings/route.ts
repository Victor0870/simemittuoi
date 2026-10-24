import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadDocumentOrgSettings, saveDocumentOrgSettings } from "@/lib/documents/settings-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;
    const settings = await loadDocumentOrgSettings(createServiceClient());
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    console.error("[api/documents/settings] GET error:", err);
    return NextResponse.json({ error: "Không tải được cài đặt văn bản." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;
    const body = await request.json().catch(() => null);
    const settings = await saveDocumentOrgSettings(createServiceClient(), body, guard.access.userId);
    return NextResponse.json({ success: true, settings });
  } catch (err: unknown) {
    console.error("[api/documents/settings] PUT error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Không lưu được cài đặt văn bản." },
      { status: 500 },
    );
  }
}
