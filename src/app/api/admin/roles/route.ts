import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { normalizePermissionCodes } from "@/lib/auth/permissions";
import { loadRolesWithDetails, writePermissionLog } from "@/lib/data/roles";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  try {
    const roles = await loadRolesWithDetails(createServiceClient());
    return NextResponse.json({ roles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải danh sách cấp.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    permissions?: string[];
  };
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Vui lòng nhập tên cấp." }, { status: 400 });
  }
  if (name.length > 60) {
    return NextResponse.json({ error: "Tên cấp tối đa 60 ký tự." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: last } = await db
    .from(CDILV_TABLE.roles)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: role, error } = await db
    .from(CDILV_TABLE.roles)
    .insert({
      name,
      description: description || null,
      sort_order: (last?.sort_order ?? 0) + 10,
      created_by: guard.access.userId,
    })
    .select("id, name")
    .single();

  if (error || !role) {
    const duplicate = error?.code === "23505";
    return NextResponse.json(
      { error: duplicate ? `Đã có cấp tên "${name}".` : error?.message || "Không tạo được cấp." },
      { status: duplicate ? 409 : 500 },
    );
  }

  const permissions = normalizePermissionCodes(body.permissions ?? []);
  if (permissions.length > 0) {
    const { error: permError } = await db
      .from(CDILV_TABLE.rolePermissions)
      .insert(permissions.map((code) => ({ role_id: role.id, permission_code: code })));
    if (permError) {
      return NextResponse.json({ error: permError.message }, { status: 500 });
    }
  }

  await writePermissionLog(db, {
    actorId: guard.access.userId,
    action: "role.create",
    roleId: role.id,
    roleName: role.name,
    detail: { permissions },
  });

  return NextResponse.json({ ok: true, id: role.id });
}
