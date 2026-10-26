import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import {
  UNION_SETTINGS_LIMITS,
  type AssignableUnionMember,
  type UnionOfficer,
  type UnionPosition,
} from "./types";

type PositionRow = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type OfficerRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  position_id: string;
  display_order: number;
  is_active: boolean;
  term: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  employee_code: string | null;
  department: string | null;
};

function mapPosition(row: PositionRow): UnionPosition {
  return {
    id: row.id,
    name: row.name,
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadUnionPositions(db: SupabaseClient): Promise<UnionPosition[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.unionPositions)
    .select("id, name, display_order, is_active, created_at, updated_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[union-settings] loadUnionPositions error:", error.message);
    return [];
  }
  return ((data ?? []) as PositionRow[]).map(mapPosition);
}

export async function loadUnionOfficers(
  db: SupabaseClient,
  options?: { activeOnly?: boolean },
): Promise<UnionOfficer[]> {
  let query = db
    .from(CDILV_TABLE.unionOfficers)
    .select("id, user_id, full_name, position_id, display_order, is_active, term, created_at, updated_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const [{ data: officerRows, error: officerErr }, positions] = await Promise.all([
    query,
    loadUnionPositions(db),
  ]);

  if (officerErr) {
    console.error("[union-settings] loadUnionOfficers error:", officerErr.message);
    return [];
  }

  const rows = (officerRows ?? []) as OfficerRow[];
  const posMap = new Map(positions.map((p) => [p.id, p]));

  const userIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => Boolean(id)))];
  const profileMap = new Map<string, ProfileRow>();

  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from(CDILV_TABLE.profiles)
      .select("id, full_name, employee_code, department")
      .in("id", userIds);
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p);
    }
  }

  const mapped: UnionOfficer[] = rows.map((row) => {
    const pos = posMap.get(row.position_id);
    const prof = row.user_id ? profileMap.get(row.user_id) : undefined;
    return {
      id: row.id,
      userId: row.user_id,
      userFullName: prof?.full_name ?? null,
      userEmployeeCode: prof?.employee_code ?? null,
      userDepartment: prof?.department ?? null,
      fullName: row.full_name,
      positionId: row.position_id,
      positionName: pos?.name ?? "Ủy viên",
      positionIsActive: pos ? pos.isActive : true,
      displayOrder: row.display_order ?? 0,
      isActive: row.is_active !== false,
      term: row.term ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  if (options?.activeOnly) {
    return mapped.filter((o) => o.isActive && o.positionIsActive);
  }
  return mapped;
}

export async function loadAssignableUnionMembers(db: SupabaseClient): Promise<AssignableUnionMember[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.profiles)
    .select("id, full_name, employee_code, department")
    .eq("approval_status", "approved")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[union-settings] loadAssignableUnionMembers error:", error.message);
    return [];
  }

  return ((data ?? []) as ProfileRow[]).map((p) => ({
    id: p.id,
    fullName: p.full_name || "Đoàn viên",
    employeeCode: p.employee_code ?? null,
    department: p.department ?? null,
  }));
}

function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanOrder(raw: unknown, fallback = 0): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-9999, Math.min(99999, Math.trunc(n)));
}

export async function createUnionPosition(
  db: SupabaseClient,
  input: unknown,
  actorId: string,
): Promise<UnionPosition> {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = cleanText(body.name, UNION_SETTINGS_LIMITS.positionName);
  if (!name) {
    throw new Error("Vui lòng nhập tên chức danh.");
  }
  const displayOrder = cleanOrder(body.displayOrder, 10);
  const isActive = body.isActive !== false;

  const { data, error } = await db
    .from(CDILV_TABLE.unionPositions)
    .insert({
      name,
      display_order: displayOrder,
      is_active: isActive,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id, name, display_order, is_active, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`Chức danh “${name}” đã tồn tại.`);
    }
    throw new Error(error.message || "Không thêm được chức danh.");
  }

  return mapPosition(data as PositionRow);
}

export async function updateUnionPosition(
  db: SupabaseClient,
  id: string,
  input: unknown,
  actorId: string,
): Promise<UnionPosition> {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if ("name" in body) {
    const name = cleanText(body.name, UNION_SETTINGS_LIMITS.positionName);
    if (!name) throw new Error("Tên chức danh không được để trống.");
    patch.name = name;
  }
  if ("displayOrder" in body) {
    patch.display_order = cleanOrder(body.displayOrder, 0);
  }
  if ("isActive" in body && typeof body.isActive === "boolean") {
    patch.is_active = body.isActive;
  }

  const { data, error } = await db
    .from(CDILV_TABLE.unionPositions)
    .update(patch)
    .eq("id", id)
    .select("id, name, display_order, is_active, created_at, updated_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Tên chức danh đã tồn tại.");
    }
    throw new Error(error.message || "Không cập nhật được chức danh.");
  }
  if (!data) {
    throw new Error("Không tìm thấy chức danh.");
  }

  return mapPosition(data as PositionRow);
}

export async function createUnionOfficer(
  db: SupabaseClient,
  input: unknown,
  actorId: string,
): Promise<UnionOfficer> {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const fullName = cleanText(body.fullName, UNION_SETTINGS_LIMITS.officerName);
  if (!fullName) {
    throw new Error("Vui lòng nhập họ và tên cán bộ công đoàn.");
  }
  const positionId = typeof body.positionId === "string" ? body.positionId.trim() : "";
  if (!positionId) {
    throw new Error("Vui lòng chọn chức danh công đoàn.");
  }
  const userId =
    typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : null;
  const termRaw = cleanText(body.term, UNION_SETTINGS_LIMITS.term);
  const term = termRaw || null;
  const displayOrder = cleanOrder(body.displayOrder, 1);
  const isActive = body.isActive !== false;

  const { data, error } = await db
    .from(CDILV_TABLE.unionOfficers)
    .insert({
      user_id: userId,
      full_name: fullName,
      position_id: positionId,
      display_order: displayOrder,
      is_active: isActive,
      term,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Không thêm được cán bộ công đoàn.");
  }

  const all = await loadUnionOfficers(db);
  const created = all.find((o) => o.id === (data as { id: string }).id);
  if (!created) throw new Error("Không tải được thông tin cán bộ vừa tạo.");
  return created;
}

export async function updateUnionOfficer(
  db: SupabaseClient,
  id: string,
  input: unknown,
  actorId: string,
): Promise<UnionOfficer> {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if ("fullName" in body) {
    const fullName = cleanText(body.fullName, UNION_SETTINGS_LIMITS.officerName);
    if (!fullName) throw new Error("Họ và tên cán bộ không được để trống.");
    patch.full_name = fullName;
  }
  if ("positionId" in body) {
    const positionId = typeof body.positionId === "string" ? body.positionId.trim() : "";
    if (!positionId) throw new Error("Vui lòng chọn chức danh công đoàn.");
    patch.position_id = positionId;
  }
  if ("userId" in body) {
    patch.user_id =
      typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : null;
  }
  if ("term" in body) {
    const termRaw = cleanText(body.term, UNION_SETTINGS_LIMITS.term);
    patch.term = termRaw || null;
  }
  if ("displayOrder" in body) {
    patch.display_order = cleanOrder(body.displayOrder, 0);
  }
  if ("isActive" in body && typeof body.isActive === "boolean") {
    patch.is_active = body.isActive;
  }

  const { data, error } = await db
    .from(CDILV_TABLE.unionOfficers)
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Không cập nhật được thông tin cán bộ.");
  }
  if (!data) {
    throw new Error("Không tìm thấy cán bộ công đoàn.");
  }

  const all = await loadUnionOfficers(db);
  const updated = all.find((o) => o.id === id);
  if (!updated) throw new Error("Không tải được thông tin cán bộ sau khi cập nhật.");
  return updated;
}

export async function deleteUnionOfficer(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from(CDILV_TABLE.unionOfficers).delete().eq("id", id);
  if (error) {
    throw new Error(error.message || "Không xóa được cán bộ công đoàn.");
  }
}
