import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { CDILV_STORAGE, CDILV_TABLE } from "@/lib/supabase/tables";
import type { LifeEventCategory, LifeEventStatus, Relation } from "./registry";

const SIGNED_URL_SECONDS = 600;

const EVENT_COLUMNS =
  "id, code, member_id, category, event_type, subject_relation, subject_name, event_date, location, description, status, handled_by, handled_at, handler_note, created_at, updated_at";

export type LifeEventRow = {
  id: string;
  code: string;
  member_id: string;
  category: LifeEventCategory;
  event_type: string;
  subject_relation: Relation;
  subject_name: string | null;
  event_date: string;
  location: string | null;
  description: string | null;
  status: LifeEventStatus;
  handled_by: string | null;
  handled_at: string | null;
  handler_note: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonRef = {
  id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
};

export type LifeEventListItem = LifeEventRow & {
  member: PersonRef | null;
  attachment_count: number;
};

export type LifeEventAttachment = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
  url: string | null;
};

export type LifeEventLog = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
  actor_name: string | null;
};

export type LifeEventDetail = LifeEventRow & {
  member: PersonRef | null;
  handler_name: string | null;
  attachments: LifeEventAttachment[];
  logs: LifeEventLog[];
};

export function canViewAllLifeEvents(access: CurrentAccess): boolean {
  return hasPermission(access, PERMISSIONS.lifeEventsView);
}

export function canHandleLifeEvents(access: CurrentAccess): boolean {
  return hasPermission(access, PERMISSIONS.lifeEventsHandle);
}

export function canViewLifeEvent(access: CurrentAccess, event: Pick<LifeEventRow, "member_id">): boolean {
  return access.isApproved && (event.member_id === access.userId || canViewAllLifeEvents(access));
}

async function loadPeople(db: SupabaseClient, ids: string[]): Promise<Map<string, PersonRef>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await db
    .from(CDILV_TABLE.profiles)
    .select("id, full_name, employee_code, department")
    .in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, p as PersonRef]));
}

async function countAttachments(db: SupabaseClient, eventIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!eventIds.length) return counts;
  const { data } = await db.from(CDILV_TABLE.lifeEventAttachments).select("event_id").in("event_id", eventIds);
  for (const a of data ?? []) counts.set(a.event_id, (counts.get(a.event_id) ?? 0) + 1);
  return counts;
}

/** memberId = null → mọi tin (hộp tin của ban chấp hành). */
export async function loadLifeEventList(
  db: SupabaseClient,
  memberId: string | null,
  limit = 500,
): Promise<LifeEventListItem[]> {
  let query = db.from(CDILV_TABLE.lifeEvents).select(EVENT_COLUMNS).order("created_at", { ascending: false }).limit(limit);
  if (memberId) query = query.eq("member_id", memberId);
  const { data, error } = await query;
  if (error) throw new Error(`Không tải được tin báo: ${error.message}`);
  const rows = (data ?? []) as LifeEventRow[];
  const [people, counts] = await Promise.all([
    loadPeople(db, rows.map((r) => r.member_id)),
    countAttachments(db, rows.map((r) => r.id)),
  ]);
  return rows.map((r) => ({
    ...r,
    member: people.get(r.member_id) ?? null,
    attachment_count: counts.get(r.id) ?? 0,
  }));
}

export async function loadLifeEventRow(db: SupabaseClient, id: string): Promise<LifeEventRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from(CDILV_TABLE.lifeEvents).select(EVENT_COLUMNS).eq("id", id).maybeSingle();
  return (data as LifeEventRow | null) ?? null;
}

export async function loadLifeEventDetail(db: SupabaseClient, id: string): Promise<LifeEventDetail | null> {
  const event = await loadLifeEventRow(db, id);
  if (!event) return null;

  const [{ data: attachments }, { data: logs }] = await Promise.all([
    db
      .from(CDILV_TABLE.lifeEventAttachments)
      .select("id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: true }),
    db
      .from(CDILV_TABLE.lifeEventLogs)
      .select("id, actor_id, action, from_status, to_status, note, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const people = await loadPeople(db, [
    event.member_id,
    event.handled_by ?? "",
    ...(logs ?? []).map((l) => (l.actor_id as string) ?? ""),
  ]);

  const paths = (attachments ?? []).map((a) => a.storage_path as string);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await db.storage.from(CDILV_STORAGE.lifeEvents).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  return {
    ...event,
    member: people.get(event.member_id) ?? null,
    handler_name: event.handled_by ? (people.get(event.handled_by)?.full_name ?? null) : null,
    attachments: (attachments ?? []).map((a) => ({
      id: a.id,
      file_name: a.file_name,
      mime_type: a.mime_type,
      size_bytes: a.size_bytes,
      uploaded_by: a.uploaded_by,
      created_at: a.created_at,
      url: signed.get(a.storage_path) ?? null,
    })),
    logs: (logs ?? []).map((l) => ({
      id: l.id,
      action: l.action,
      from_status: l.from_status,
      to_status: l.to_status,
      note: l.note,
      created_at: l.created_at,
      actor_name: l.actor_id ? (people.get(l.actor_id)?.full_name ?? null) : null,
    })),
  };
}
