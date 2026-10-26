import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import {
  UNION_SETTINGS_LIMITS,
  getCurrentTermActiveHolders,
  isOfficerInCurrentTerm,
  resolveCurrentUnionTerm,
  type AssignableUnionMember,
  type UnionOfficer,
  type UnionPosition,
} from "./types";

type PositionRow = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  max_holders: number | null;
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

const POSITION_SELECT_COLUMNS =
  "id, name, display_order, is_active, max_holders, created_at, updated_at";

function mapPosition(row: PositionRow): UnionPosition {
  return {
    id: row.id,
    name: row.name,
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active !== false,
    maxHolders:
      typeof row.max_holders === "number" && Number.isFinite(row.max_holders)
        ? row.max_holders
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadUnionPositions(db: SupabaseClient): Promise<UnionPosition[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.unionPositions)
    .select(POSITION_SELECT_COLUMNS)
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

function cleanMaxHolders(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "string" && !raw.trim()) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1 || n > UNION_SETTINGS_LIMITS.maxHolders) {
    throw new Error(
      "Số người tối đa phải là số nguyên từ 1 trở lên (hoặc để trống nếu không giới hạn).",
    );
  }
  return n;
}

function verifyPositionHolderLimit(params: {
  positions: ReadonlyArray<UnionPosition>;
  officers: ReadonlyArray<UnionOfficer>;
  positionId: string;
  isActive: boolean;
  term: string | null;
  officerId?: string;
}): void {
  const pos = params.positions.find((p) => p.id === params.positionId);
  if (!pos) {
    throw new Error("Không tìm thấy chức danh công đoàn đã chọn.");
  }

  // Chỉ kiểm tra giới hạn đối với cán bộ đang hoạt động và chức danh có giới hạn maxHolders
  if (!params.isActive || pos.maxHolders === null) {
    return;
  }

  // Kiểm tra xem cán bộ này có thuộc nhiệm kỳ hiện tại hay không
  const pool: Array<Pick<UnionOfficer, "isActive" | "term">> = params.officers.map((o) => ({
    isActive: o.isActive,
    term: o.term,
  }));
  pool.push({ isActive: true, term: params.term });

  const currentTerm = resolveCurrentUnionTerm(pool);
  if (!isOfficerInCurrentTerm({ isActive: true, term: params.term }, currentTerm)) {
    return;
  }

  const holders = getCurrentTermActiveHolders(params.officers, params.positionId, {
    candidateTerm: params.term,
  });

  // Cán bộ đang giữ chính chức danh này chỉ sửa thông tin khác: không tính 2 lần, và dữ liệu cũ
  // đang vượt giới hạn vẫn sửa được (chỉ chặn khi có thêm người mới nhận chức danh).
  if (params.officerId && holders.some((h) => h.id === params.officerId)) {
    return;
  }

  if (holders.length >= pos.maxHolders) {
    const holderNames = holders.map((h) => h.fullName).join(", ");
    throw new Error(
      `Chức danh ${pos.name} đã đủ ${holders.length}/${pos.maxHolders} người (${holderNames}).`,
    );
  }
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
  const maxHolders = cleanMaxHolders(body.maxHolders);

  const { data, error } = await db
    .from(CDILV_TABLE.unionPositions)
    .insert({
      name,
      display_order: displayOrder,
      is_active: isActive,
      max_holders: maxHolders,
      created_by: actorId,
      updated_by: actorId,
    })
    .select(POSITION_SELECT_COLUMNS)
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
  if ("maxHolders" in body) {
    const maxHolders = cleanMaxHolders(body.maxHolders);
    if (maxHolders !== null) {
      const [positions, officers] = await Promise.all([
        loadUnionPositions(db),
        loadUnionOfficers(db),
      ]);
      const existingPos = positions.find((p) => p.id === id);
      if (!existingPos) {
        throw new Error("Không tìm thấy chức danh.");
      }
      const posName =
        typeof patch.name === "string" && patch.name ? patch.name : existingPos.name;
      const isLowering = existingPos.maxHolders === null || maxHolders < existingPos.maxHolders;
      const activeHolders = getCurrentTermActiveHolders(officers, id);
      if (isLowering && activeHolders.length > maxHolders) {
        const holderNames = activeHolders.map((h) => h.fullName).join(", ");
        throw new Error(
          `Không thể đặt số người tối đa là ${maxHolders} vì chức danh ${posName} hiện đang có ${activeHolders.length} người giữ (${holderNames}).`,
        );
      }
    }
    patch.max_holders = maxHolders;
  }

  const { data, error } = await db
    .from(CDILV_TABLE.unionPositions)
    .update(patch)
    .eq("id", id)
    .select(POSITION_SELECT_COLUMNS)
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

  const [positions, existingOfficers] = await Promise.all([
    loadUnionPositions(db),
    loadUnionOfficers(db),
  ]);

  verifyPositionHolderLimit({
    positions,
    officers: existingOfficers,
    positionId,
    isActive,
    term,
  });

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

  const [positions, existingOfficers] = await Promise.all([
    loadUnionPositions(db),
    loadUnionOfficers(db),
  ]);
  const existing = existingOfficers.find((o) => o.id === id);
  if (!existing) {
    throw new Error("Không tìm thấy cán bộ công đoàn.");
  }

  verifyPositionHolderLimit({
    positions,
    officers: existingOfficers,
    positionId: typeof patch.position_id === "string" ? patch.position_id : existing.positionId,
    isActive: typeof patch.is_active === "boolean" ? patch.is_active : existing.isActive,
    term: "term" in patch ? (patch.term as string | null) : existing.term,
    officerId: id,
  });

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
