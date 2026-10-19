import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { writePermissionLog } from "@/lib/data/roles";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

type Params = { params: Promise<{ id: string }> };

async function loadRoleAndUser(roleId: string, userId: string) {
  const db = createServiceClient();
  const [{ data: role }, { data: user }] = await Promise.all([
    db.from(CDILV_TABLE.roles).select("id, name").eq("id", roleId).maybeSingle(),
    db
      .from(CDILV_TABLE.profiles)
      .select("id, full_name, approval_status")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  return { db, role, user };
}

export async function POST(request: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ error: "Thiếu thành viên cần gán." }, { status: 400 });
  }

  const { db, role, user } = await loadRoleAndUser(id, userId);
  if (!role) return NextResponse.json({ error: "Không tìm thấy cấp này." }, { status: 404 });
  if (!user) return NextResponse.json({ error: "Không tìm thấy thành viên." }, { status: 404 });
  if (user.approval_status !== "approved") {
    return NextResponse.json(
      { error: "Chỉ gán cấp cho tài khoản đã được duyệt." },
      { status: 400 },
    );
  }

  const { error } = await db.from(CDILV_TABLE.userRoles).insert({
    user_id: userId,
    role_id: id,
    granted_by: guard.access.userId,
  });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `${user.full_name} đã thuộc cấp ${role.name}.` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writePermissionLog(db, {
    actorId: guard.access.userId,
    action: "user.grant",
    roleId: id,
    roleName: role.name,
    targetUserId: userId,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await params;
  const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "Thiếu thành viên cần gỡ." }, { status: 400 });
  }

  const { db, role, user } = await loadRoleAndUser(id, userId);
  if (!role) return NextResponse.json({ error: "Không tìm thấy cấp này." }, { status: 404 });

  const { error } = await db
    .from(CDILV_TABLE.userRoles)
    .delete()
    .eq("role_id", id)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writePermissionLog(db, {
    actorId: guard.access.userId,
    action: "user.revoke",
    roleId: id,
    roleName: role.name,
    targetUserId: user ? userId : null,
  });

  return NextResponse.json({ ok: true });
}
