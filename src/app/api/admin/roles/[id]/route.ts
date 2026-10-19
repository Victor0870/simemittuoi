import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { normalizePermissionCodes } from "@/lib/auth/permissions";
import { writePermissionLog } from "@/lib/data/roles";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
    permissions?: string[];
  };

  const db = createServiceClient();
  const { data: role } = await db
    .from(CDILV_TABLE.roles)
    .select("id, name, description")
    .eq("id", id)
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "Không tìm thấy cấp này." }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Tên cấp không được để trống." }, { status: 400 });
    if (name.length > 60) {
      return NextResponse.json({ error: "Tên cấp tối đa 60 ký tự." }, { status: 400 });
    }
    update.name = name;
  }
  if (body.description !== undefined) {
    update.description = String(body.description ?? "").trim() || null;
  }

  if (Object.keys(update).length > 0) {
    update.updated_at = new Date().toISOString();
    const { error } = await db.from(CDILV_TABLE.roles).update(update).eq("id", id);
    if (error) {
      const duplicate = error.code === "23505";
      return NextResponse.json(
        { error: duplicate ? `Đã có cấp tên "${update.name}".` : error.message },
        { status: duplicate ? 409 : 500 },
      );
    }
  }

  let permissionDiff: { added: string[]; removed: string[] } | null = null;
  if (Array.isArray(body.permissions)) {
    const next = normalizePermissionCodes(body.permissions);
    const { data: currentRows } = await db
      .from(CDILV_TABLE.rolePermissions)
      .select("permission_code")
      .eq("role_id", id);
    const current = new Set((currentRows ?? []).map((r) => r.permission_code));
    const added = next.filter((c) => !current.has(c));
    const removed = [...current].filter((c) => !next.includes(c));

    if (removed.length > 0) {
      const { error } = await db
        .from(CDILV_TABLE.rolePermissions)
        .delete()
        .eq("role_id", id)
        .in("permission_code", removed);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (added.length > 0) {
      const { error } = await db
        .from(CDILV_TABLE.rolePermissions)
        .insert(added.map((code) => ({ role_id: id, permission_code: code })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (added.length > 0 || removed.length > 0) permissionDiff = { added, removed };
  }

  if (Object.keys(update).length > 0 || permissionDiff) {
    await writePermissionLog(db, {
      actorId: guard.access.userId,
      action: "role.update",
      roleId: id,
      roleName: (update.name as string | undefined) ?? role.name,
      detail: {
        ...(update.name && update.name !== role.name ? { renamed_from: role.name } : {}),
        ...(permissionDiff ?? {}),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await params;
  const db = createServiceClient();
  const { data: role } = await db
    .from(CDILV_TABLE.roles)
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "Không tìm thấy cấp này." }, { status: 404 });
  }

  const { count: memberCount } = await db
    .from(CDILV_TABLE.userRoles)
    .select("user_id", { count: "exact", head: true })
    .eq("role_id", id);

  const { error } = await db.from(CDILV_TABLE.roles).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writePermissionLog(db, {
    actorId: guard.access.userId,
    action: "role.delete",
    roleId: id,
    roleName: role.name,
    detail: { member_count: memberCount ?? 0 },
  });

  return NextResponse.json({ ok: true });
}
