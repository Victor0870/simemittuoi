import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type RoleMember = {
  id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  avatar_url: string | null;
};

export type RoleWithDetails = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  permissions: string[];
  members: RoleMember[];
};

export type PermissionLogRow = {
  id: string;
  action: string;
  role_name: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
  actor_name: string | null;
  target_name: string | null;
};

/** Đọc bằng service client (đã kiểm tra quyền admin trước khi gọi). */
export async function loadRolesWithDetails(db: SupabaseClient): Promise<RoleWithDetails[]> {
  const [{ data: roles, error }, { data: perms }, { data: userRoles }] = await Promise.all([
    db
      .from(CDILV_TABLE.roles)
      .select("id, name, description, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    db.from(CDILV_TABLE.rolePermissions).select("role_id, permission_code"),
    db
      .from(CDILV_TABLE.userRoles)
      .select(
        "role_id, granted_at, cdilv_profiles!cdilv_user_roles_user_id_fkey ( id, full_name, employee_code, department, avatar_url )",
      )
      .order("granted_at", { ascending: true }),
  ]);

  if (error) throw new Error(error.message);

  const permsByRole = new Map<string, string[]>();
  for (const p of perms ?? []) {
    const list = permsByRole.get(p.role_id) ?? [];
    list.push(p.permission_code);
    permsByRole.set(p.role_id, list);
  }

  const membersByRole = new Map<string, RoleMember[]>();
  for (const row of userRoles ?? []) {
    const raw = (row as { cdilv_profiles: RoleMember | RoleMember[] | null }).cdilv_profiles;
    const prof = Array.isArray(raw) ? raw[0] : raw;
    if (!prof) continue;
    const list = membersByRole.get(row.role_id) ?? [];
    list.push(prof);
    membersByRole.set(row.role_id, list);
  }

  return (roles ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    sort_order: r.sort_order,
    permissions: (permsByRole.get(r.id) ?? []).sort(),
    members: membersByRole.get(r.id) ?? [],
  }));
}

export async function loadRecentPermissionLogs(
  db: SupabaseClient,
  limit = 30,
): Promise<PermissionLogRow[]> {
  const { data } = await db
    .from(CDILV_TABLE.permissionLogs)
    .select(
      "id, action, role_name, detail, created_at, actor:cdilv_profiles!cdilv_permission_logs_actor_id_fkey ( full_name ), target:cdilv_profiles!cdilv_permission_logs_target_user_id_fkey ( full_name )",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  type Joined = { full_name: string } | { full_name: string }[] | null;
  const pick = (v: Joined) => (Array.isArray(v) ? v[0]?.full_name : v?.full_name) ?? null;

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      action: string;
      role_name: string | null;
      detail: Record<string, unknown> | null;
      created_at: string;
      actor: Joined;
      target: Joined;
    };
    return {
      id: r.id,
      action: r.action,
      role_name: r.role_name,
      detail: r.detail,
      created_at: r.created_at,
      actor_name: pick(r.actor),
      target_name: pick(r.target),
    };
  });
}

export async function writePermissionLog(
  db: SupabaseClient,
  entry: {
    actorId: string;
    action: string;
    roleId?: string | null;
    roleName?: string | null;
    targetUserId?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  const { error } = await db.from(CDILV_TABLE.permissionLogs).insert({
    actor_id: entry.actorId,
    action: entry.action,
    role_id: entry.roleId ?? null,
    role_name: entry.roleName ?? null,
    target_user_id: entry.targetUserId ?? null,
    detail: entry.detail ?? null,
  });
  if (error) console.error("[permission-log]", error.message);
}
