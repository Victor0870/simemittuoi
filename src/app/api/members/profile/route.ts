import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess, type CurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadMemberProfile, saveMemberProfile } from "@/lib/members/profile-server";
import type { SaveProfilePayload } from "@/lib/members/profile-shared";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

/** Đoàn viên chỉ truy cập hồ sơ của mình; hồ sơ người khác cần members.view / members.edit. */
function resolveTarget(
  access: CurrentAccess | null,
  requested: string | null | undefined,
  mode: "view" | "edit",
): { targetId: string; isSelf: boolean } | NextResponse {
  if (!access) {
    return NextResponse.json({ error: "Vui lòng đăng nhập tài khoản." }, { status: 401 });
  }
  if (!access.isApproved) {
    return NextResponse.json({ error: "Tài khoản chưa được duyệt." }, { status: 403 });
  }
  const targetId = requested?.trim() || access.userId;
  const isSelf = targetId === access.userId;
  if (!isSelf) {
    const needed = mode === "view" ? PERMISSIONS.membersView : PERMISSIONS.membersEdit;
    if (!hasPermission(access, needed)) {
      return NextResponse.json(
        { error: "Bạn chưa được phân quyền với hồ sơ của đoàn viên khác." },
        { status: 403 },
      );
    }
  }
  return { targetId, isSelf };
}

export async function GET(request: NextRequest) {
  const access = await getCurrentAccess();
  const target = resolveTarget(access, request.nextUrl.searchParams.get("userId"), "view");
  if (target instanceof NextResponse) return target;

  const profile = await loadMemberProfile(createServiceClient(), target.targetId);
  if (!profile) {
    return NextResponse.json({ error: "Không tìm thấy đoàn viên." }, { status: 404 });
  }
  return NextResponse.json(profile);
}

export async function PUT(request: NextRequest) {
  const access = await getCurrentAccess();
  const payload = (await request.json().catch(() => null)) as SaveProfilePayload | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const target = resolveTarget(access, payload.userId, "edit");
  if (target instanceof NextResponse) return target;

  const db = createServiceClient();
  const { data: targetProfile } = await db
    .from(CDILV_TABLE.profiles)
    .select("id")
    .eq("id", target.targetId)
    .maybeSingle();
  if (!targetProfile) {
    return NextResponse.json({ error: "Không tìm thấy đoàn viên." }, { status: 404 });
  }

  try {
    const result = await saveMemberProfile(db, {
      targetId: target.targetId,
      actorId: access!.userId,
      payload,
      requireConsent: target.isSelf,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.errors[0], errors: result.errors },
        { status: result.status },
      );
    }
    const profile = await loadMemberProfile(db, target.targetId);
    return NextResponse.json({
      ok: true,
      changed: result.changed,
      awardedPoints: result.awardedPoints,
      awardedLabels: result.awardedLabels,
      profile,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không lưu được hồ sơ.";
    console.error("[members/profile] save error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
