import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import type { VisitStatus } from "./registry";

const REQUEST_COLUMNS =
  "id, code, life_event_id, member_id, member_employee_code, member_name, member_department, event_type, reason, amount, visitor_name, note, status, created_by, decided_by, decided_at, decision_note, paid_by, paid_at, created_at, updated_at";

export type VisitRequestRow = {
  id: string;
  code: string;
  life_event_id: string | null;
  member_id: string | null;
  member_employee_code: string;
  member_name: string;
  member_department: string | null;
  event_type: string | null;
  reason: string;
  amount: number;
  visitor_name: string;
  note: string | null;
  status: VisitStatus;
  created_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  paid_by: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitRequestListItem = VisitRequestRow & {
  creator_name: string | null;
  life_event_code: string | null;
};

export type VisitRequestLog = {
  id: string;
  action: string;
  note: string | null;
  created_at: string;
  actor_name: string | null;
};

export type VisitRequestDetail = VisitRequestListItem & {
  decider_name: string | null;
  payer_name: string | null;
  logs: VisitRequestLog[];
};

export type VisitAbilities = {
  view: boolean;
  create: boolean;
  approve: boolean;
  pay: boolean;
};

export function visitAbilities(access: CurrentAccess): VisitAbilities {
  return {
    view: hasPermission(access, PERMISSIONS.visitsView),
    create: hasPermission(access, PERMISSIONS.visitsCreate),
    approve: hasPermission(access, PERMISSIONS.visitsApprove),
    pay: hasPermission(access, PERMISSIONS.visitsPay),
  };
}

async function loadNames(db: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const { data } = await db.from(CDILV_TABLE.profiles).select("id, full_name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
}

async function loadEventCodes(db: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const { data } = await db.from(CDILV_TABLE.lifeEvents).select("id, code").in("id", unique);
  return new Map((data ?? []).map((e) => [e.id as string, e.code as string]));
}

/** lifeEventId → chỉ các phiếu lập từ tin báo đó. */
export async function loadVisitRequestList(
  db: SupabaseClient,
  options: { lifeEventId?: string; limit?: number } = {},
): Promise<VisitRequestListItem[]> {
  let query = db
    .from(CDILV_TABLE.visitRequests)
    .select(REQUEST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 1000);
  if (options.lifeEventId) query = query.eq("life_event_id", options.lifeEventId);
  const { data, error } = await query;
  if (error) throw new Error(`Không tải được đề nghị thăm hỏi: ${error.message}`);
  const rows = (data ?? []) as VisitRequestRow[];
  const [names, events] = await Promise.all([
    loadNames(db, rows.map((r) => r.created_by)),
    loadEventCodes(db, rows.map((r) => r.life_event_id)),
  ]);
  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    creator_name: r.created_by ? (names.get(r.created_by) ?? null) : null,
    life_event_code: r.life_event_id ? (events.get(r.life_event_id) ?? null) : null,
  }));
}

export async function loadVisitRequestRow(db: SupabaseClient, id: string): Promise<VisitRequestRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from(CDILV_TABLE.visitRequests).select(REQUEST_COLUMNS).eq("id", id).maybeSingle();
  return data ? ({ ...data, amount: Number(data.amount) } as VisitRequestRow) : null;
}

export async function loadVisitRequestDetail(db: SupabaseClient, id: string): Promise<VisitRequestDetail | null> {
  const row = await loadVisitRequestRow(db, id);
  if (!row) return null;
  const { data: logs } = await db
    .from(CDILV_TABLE.visitRequestLogs)
    .select("id, actor_id, action, note, created_at")
    .eq("request_id", id)
    .order("created_at", { ascending: true });
  const [names, events] = await Promise.all([
    loadNames(db, [row.created_by, row.decided_by, row.paid_by, ...(logs ?? []).map((l) => l.actor_id as string | null)]),
    loadEventCodes(db, [row.life_event_id]),
  ]);
  const name = (uid: string | null) => (uid ? (names.get(uid) ?? null) : null);
  return {
    ...row,
    creator_name: name(row.created_by),
    decider_name: name(row.decided_by),
    payer_name: name(row.paid_by),
    life_event_code: row.life_event_id ? (events.get(row.life_event_id) ?? null) : null,
    logs: (logs ?? []).map((l) => ({
      id: l.id,
      action: l.action,
      note: l.note,
      created_at: l.created_at,
      actor_name: name(l.actor_id),
    })),
  };
}

/** Tài khoản web của đoàn viên (nếu đã đăng ký) theo mã nhân viên. */
export async function findProfileIdByEmployeeCode(db: SupabaseClient, code: string): Promise<string | null> {
  const { data } = await db
    .from(CDILV_TABLE.profiles)
    .select("id")
    .eq("employee_code", code)
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
