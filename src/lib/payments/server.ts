import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import type { Counterparty } from "@/lib/catalogs/registry";
import { loadCounterparty } from "@/lib/catalogs/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { loadNames } from "@/lib/visits/server";
import type { PaymentMethod, PaymentReceiverKind, PaymentStatus } from "./registry";

const REQUEST_COLUMNS =
  "id, code, request_date, title, requester_name, requester_department, payment_method, receiver_kind, receiver_member_id, receiver_name, receiver_account, receiver_bank, counterparty_id, fund_category_id, total_amount, advanced_amount, note, status, created_by, decided_by, decided_at, decision_note, paid_by, paid_at, created_at, updated_at";

const ITEM_COLUMNS = "id, order_num, content, paid_to, amount, advanced, visit_request_id, reward_poll_id";

/** Đề nghị còn hiệu lực – phiếu thăm hỏi đã nằm trong các đề nghị này thì không gom lại được. */
const ACTIVE_STATUSES: PaymentStatus[] = ["proposed", "approved", "paid"];

export type PaymentRequestRow = {
  id: string;
  code: string;
  request_date: string;
  title: string;
  requester_name: string;
  requester_department: string | null;
  payment_method: PaymentMethod;
  receiver_kind: PaymentReceiverKind | null;
  receiver_member_id: string | null;
  receiver_name: string | null;
  receiver_account: string | null;
  receiver_bank: string | null;
  counterparty_id: string | null;
  /** Danh mục chi người duyệt chọn – dùng khi tự ghi phiếu chi lúc “Đã chi” (null = đề nghị cũ, ghi theo mặc định). */
  fund_category_id: string | null;
  total_amount: number;
  advanced_amount: number;
  note: string | null;
  status: PaymentStatus;
  created_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  paid_by: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentItemRow = {
  id: string;
  order_num: number;
  content: string;
  paid_to: string | null;
  amount: number;
  advanced: number;
  visit_request_id: string | null;
  visit_code: string | null;
  reward_poll_id: string | null;
  reward_poll_title: string | null;
};

export type PaymentRequestListItem = PaymentRequestRow & {
  creator_name: string | null;
  item_count: number;
  /** Có dòng chi theo danh sách thưởng – chuyển khoản theo từng người ở trang Thanh toán thưởng. */
  has_reward_list: boolean;
  /** Mã NV (người nhận là đoàn viên) hoặc mã đối tượng trong danh mục – cho bảng chuyển khoản. */
  receiver_code: string | null;
};

export type PaymentRequestLog = {
  id: string;
  action: string;
  note: string | null;
  created_at: string;
  actor_name: string | null;
};

/** Đoàn viên chọn làm người nhận tiền (không kèm số tài khoản). */
export type PaymentMember = {
  id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
};

/** Tài khoản ngân hàng đoàn viên đã khai trong hồ sơ. */
export type PaymentMemberBank = {
  bank_account_no: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_holder: string | null;
};

export type PaymentRequestDetail = PaymentRequestRow & {
  counterparty: Counterparty | null;
  receiver_member: PaymentMember | null;
  creator_name: string | null;
  decider_name: string | null;
  payer_name: string | null;
  items: PaymentItemRow[];
  logs: PaymentRequestLog[];
};

export type PaymentAbilities = {
  view: boolean;
  create: boolean;
  approve: boolean;
  pay: boolean;
};

/** Phiếu thăm hỏi đã duyệt, chưa nằm trong đề nghị thanh toán nào còn hiệu lực. */
export type VisitCandidate = {
  id: string;
  code: string;
  member_name: string;
  member_department: string | null;
  reason: string;
  amount: number;
  visitor_name: string;
    decided_at: string | null;
};

/** Chương trình bình chọn đã kết thúc – lấy tổng tiền thưởng thành một dòng chi. */
export type RewardCandidate = {
  id: string;
  title: string;
  closedAt: string | null;
  /** Mã đề nghị còn hiệu lực đã chứa danh sách này (không thêm lại được). */
  linkedCode: string | null;
};

export function paymentAbilities(access: CurrentAccess): PaymentAbilities {
  return {
    view: hasPermission(access, PERMISSIONS.paymentsView),
    create: hasPermission(access, PERMISSIONS.paymentsCreate),
    approve: hasPermission(access, PERMISSIONS.paymentsApprove),
    pay: hasPermission(access, PERMISSIONS.paymentsPay),
  };
}

function normalizeRow(data: Record<string, unknown>): PaymentRequestRow {
  const row = data as unknown as PaymentRequestRow;
  return { ...row, total_amount: Number(row.total_amount), advanced_amount: Number(row.advanced_amount) };
}

export async function loadPaymentRequestList(db: SupabaseClient, limit = 1000): Promise<PaymentRequestListItem[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.paymentRequests)
    .select(REQUEST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Không tải được đề nghị thanh toán: ${error.message}`);
  const rows = (data ?? []).map(normalizeRow);
  const ids = rows.map((r) => r.id);
  const memberIds = [...new Set(rows.map((r) => r.receiver_member_id).filter((x): x is string => Boolean(x)))];
  const partyIds = [...new Set(rows.map((r) => r.counterparty_id).filter((x): x is string => Boolean(x)))];
  const [names, items, members, parties] = await Promise.all([
    loadNames(db, rows.map((r) => r.created_by)),
    ids.length
      ? db.from(CDILV_TABLE.paymentRequestItems).select("request_id, reward_poll_id").in("request_id", ids)
      : Promise.resolve({ data: [] as { request_id: string; reward_poll_id: string | null }[] }),
    memberIds.length
      ? db.from(CDILV_TABLE.profiles).select("id, employee_code").in("id", memberIds)
      : Promise.resolve({ data: [] as { id: string; employee_code: string | null }[] }),
    partyIds.length
      ? db.from(CDILV_TABLE.counterparties).select("id, code").in("id", partyIds)
      : Promise.resolve({ data: [] as { id: string; code: string | null }[] }),
  ]);
  const counts = new Map<string, number>();
  const withRewards = new Set<string>();
  for (const item of (items.data ?? []) as { request_id: string; reward_poll_id: string | null }[]) {
    counts.set(item.request_id, (counts.get(item.request_id) ?? 0) + 1);
    if (item.reward_poll_id) withRewards.add(item.request_id);
  }
  const memberCodes = new Map(
    ((members.data ?? []) as { id: string; employee_code: string | null }[]).map((m) => [m.id, m.employee_code]),
  );
  const partyCodes = new Map(((parties.data ?? []) as { id: string; code: string | null }[]).map((p) => [p.id, p.code]));
  return rows.map((r) => ({
    ...r,
    creator_name: r.created_by ? (names.get(r.created_by) ?? null) : null,
    item_count: counts.get(r.id) ?? 0,
    has_reward_list: withRewards.has(r.id),
    receiver_code:
      (r.receiver_member_id ? memberCodes.get(r.receiver_member_id) : null) ??
      (r.counterparty_id ? partyCodes.get(r.counterparty_id) : null) ??
      null,
  }));
}

export async function loadPaymentRequestRow(db: SupabaseClient, id: string): Promise<PaymentRequestRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from(CDILV_TABLE.paymentRequests).select(REQUEST_COLUMNS).eq("id", id).maybeSingle();
  return data ? normalizeRow(data) : null;
}

export async function loadPaymentItems(db: SupabaseClient, requestId: string): Promise<PaymentItemRow[]> {
  const { data } = await db
    .from(CDILV_TABLE.paymentRequestItems)
    .select(ITEM_COLUMNS)
    .eq("request_id", requestId)
    .order("order_num", { ascending: true });
  const items = (data ?? []) as Omit<PaymentItemRow, "visit_code" | "reward_poll_title">[];
  const visitIds = items.map((i) => i.visit_request_id).filter((v): v is string => Boolean(v));
  const pollIds = items.map((i) => i.reward_poll_id).filter((v): v is string => Boolean(v));
  const codes = new Map<string, string>();
  const pollTitles = new Map<string, string>();
  await Promise.all([
    visitIds.length
      ? db
          .from(CDILV_TABLE.visitRequests)
          .select("id, code")
          .in("id", visitIds)
          .then(({ data: visits }) => {
            for (const v of visits ?? []) codes.set(v.id as string, v.code as string);
          })
      : null,
    pollIds.length
      ? db
          .from(CDILV_TABLE.polls)
          .select("id, title")
          .in("id", pollIds)
          .then(({ data: polls }) => {
            for (const p of polls ?? []) pollTitles.set(p.id as string, p.title as string);
          })
      : null,
  ]);
  return items.map((i) => ({
    ...i,
    amount: Number(i.amount),
    advanced: Number(i.advanced),
    visit_code: i.visit_request_id ? (codes.get(i.visit_request_id) ?? null) : null,
    reward_poll_title: i.reward_poll_id ? (pollTitles.get(i.reward_poll_id) ?? null) : null,
  }));
}

export async function loadPaymentRequestDetail(db: SupabaseClient, id: string): Promise<PaymentRequestDetail | null> {
  const row = await loadPaymentRequestRow(db, id);
  if (!row) return null;
  const [items, { data: logs }, counterparty, receiverMember] = await Promise.all([
    loadPaymentItems(db, id),
    db
      .from(CDILV_TABLE.paymentRequestLogs)
      .select("id, actor_id, action, note, created_at")
      .eq("request_id", id)
      .order("created_at", { ascending: true }),
    row.counterparty_id ? loadCounterparty(db, row.counterparty_id) : Promise.resolve(null),
    row.receiver_member_id ? loadPaymentMember(db, row.receiver_member_id) : Promise.resolve(null),
  ]);
  const names = await loadNames(db, [
    row.created_by,
    row.decided_by,
    row.paid_by,
    ...(logs ?? []).map((l) => l.actor_id as string | null),
  ]);
  const name = (uid: string | null) => (uid ? (names.get(uid) ?? null) : null);
  return {
    ...row,
    counterparty,
    receiver_member: receiverMember,
    creator_name: name(row.created_by),
    decider_name: name(row.decided_by),
    payer_name: name(row.paid_by),
    items,
    logs: (logs ?? []).map((l) => ({
      id: l.id,
      action: l.action,
      note: l.note,
      created_at: l.created_at,
      actor_name: name(l.actor_id),
    })),
  };
}

/** visit id → mã đề nghị thanh toán còn hiệu lực đang chứa phiếu đó (bỏ qua đề nghị exceptId). */
async function loadActiveVisitLinks(
  db: SupabaseClient,
  visitIds: string[] | null,
  exceptId?: string,
): Promise<Map<string, { id: string; code: string; status: PaymentStatus }>> {
  let query = db
    .from(CDILV_TABLE.paymentRequestItems)
    .select("visit_request_id, request:cdilv_payment_requests!inner(id, code, status)")
    .not("visit_request_id", "is", null)
    .in("request.status", ACTIVE_STATUSES);
  if (visitIds) query = query.in("visit_request_id", visitIds);
  const { data, error } = await query;
  if (error) throw new Error(`Không kiểm tra được phiếu thăm hỏi đã gom: ${error.message}`);
  const links = new Map<string, { id: string; code: string; status: PaymentStatus }>();
  for (const row of (data ?? []) as unknown as {
    visit_request_id: string;
    request: { id: string; code: string; status: PaymentStatus };
  }[]) {
    if (row.request.id === exceptId) continue;
    links.set(row.visit_request_id, row.request);
  }
  return links;
}

/** Phiếu thăm hỏi đã duyệt chưa gom vào đề nghị nào (exceptId: đề nghị đang sửa, coi như chưa gom). */
export async function loadVisitCandidates(db: SupabaseClient, exceptId?: string): Promise<VisitCandidate[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.visitRequests)
    .select("id, code, member_name, member_department, reason, amount, visitor_name, decided_at")
    .eq("status", "approved")
    .order("decided_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(`Không tải được phiếu thăm hỏi: ${error.message}`);
  const visits = (data ?? []) as VisitCandidate[];
  if (!visits.length) return [];
  const links = await loadActiveVisitLinks(db, visits.map((v) => v.id), exceptId);
  return visits.filter((v) => !links.has(v.id)).map((v) => ({ ...v, amount: Number(v.amount) }));
}

/**
 * Kiểm tra các phiếu thăm hỏi được gom: phải đang “Đã duyệt” và chưa nằm trong đề nghị khác.
 * keepIds: phiếu đã có sẵn trong đề nghị đang sửa (giữ nguyên dù trạng thái thế nào).
 */
export async function validateVisitLinks(
  db: SupabaseClient,
  visitIds: string[],
  options: { exceptId?: string; keepIds?: string[] } = {},
): Promise<string[]> {
  const keep = new Set(options.keepIds ?? []);
  const ids = visitIds.filter((id) => !keep.has(id));
  if (!ids.length) return [];
  const { data } = await db.from(CDILV_TABLE.visitRequests).select("id, code, status").in("id", ids);
  const found = new Map((data ?? []).map((v) => [v.id as string, v as { id: string; code: string; status: string }]));
  const errors: string[] = [];
  for (const id of ids) {
    const visit = found.get(id);
    if (!visit) errors.push("Có phiếu thăm hỏi không còn tồn tại.");
    else if (visit.status !== "approved") errors.push(`Phiếu thăm hỏi ${visit.code} chưa ở trạng thái “Đã duyệt”.`);
  }
  const links = await loadActiveVisitLinks(db, ids, options.exceptId);
  for (const id of ids) {
    const link = links.get(id);
    if (link) errors.push(`Phiếu thăm hỏi ${found.get(id)?.code ?? ""} đã nằm trong đề nghị ${link.code}.`);
  }
  return errors;
}

/** Đề nghị thanh toán (còn hiệu lực) đang chứa phiếu thăm hỏi – hiện trên trang chi tiết phiếu. */
export async function loadPaymentForVisit(
  db: SupabaseClient,
  visitId: string,
): Promise<{ id: string; code: string; status: PaymentStatus } | null> {
  const links = await loadActiveVisitLinks(db, [visitId]);
  return links.get(visitId) ?? null;
}

/** poll id → đề nghị còn hiệu lực đang chứa danh sách thưởng của chương trình đó (bỏ qua đề nghị exceptId). */
async function loadActiveRewardLinks(
  db: SupabaseClient,
  pollIds: string[] | null,
  exceptId?: string,
): Promise<Map<string, { id: string; code: string; status: PaymentStatus }>> {
  let query = db
    .from(CDILV_TABLE.paymentRequestItems)
    .select("reward_poll_id, request:cdilv_payment_requests!inner(id, code, status)")
    .not("reward_poll_id", "is", null)
    .in("request.status", ACTIVE_STATUSES);
  if (pollIds) query = query.in("reward_poll_id", pollIds);
  const { data, error } = await query;
  if (error) throw new Error(`Không kiểm tra được danh sách thưởng đã lập đề nghị: ${error.message}`);
  const links = new Map<string, { id: string; code: string; status: PaymentStatus }>();
  for (const row of (data ?? []) as unknown as {
    reward_poll_id: string;
    request: { id: string; code: string; status: PaymentStatus };
  }[]) {
    if (row.request.id === exceptId) continue;
    links.set(row.reward_poll_id, row.request);
  }
  return links;
}

/** Chương trình bình chọn đã kết thúc kèm đề nghị đang chứa danh sách thưởng (exceptId: đề nghị đang sửa). */
export async function loadRewardCandidates(db: SupabaseClient, exceptId?: string): Promise<RewardCandidate[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.polls)
    .select("id, title, closed_at")
    .eq("status", "closed")
    .order("closed_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw new Error(`Không tải được chương trình bình chọn: ${error.message}`);
  const polls = data ?? [];
  if (!polls.length) return [];
  const links = await loadActiveRewardLinks(db, polls.map((p) => p.id as string), exceptId);
  return polls.map((p) => ({
    id: p.id as string,
    title: p.title as string,
    closedAt: (p.closed_at as string | null) ?? null,
    linkedCode: links.get(p.id as string)?.code ?? null,
  }));
}

/**
 * Kiểm tra danh sách thưởng được thêm: chương trình phải đã kết thúc và chưa nằm trong đề nghị khác.
 * keepIds: danh sách đã có sẵn trong đề nghị đang sửa.
 */
export async function validateRewardLinks(
  db: SupabaseClient,
  pollIds: string[],
  options: { exceptId?: string; keepIds?: string[] } = {},
): Promise<string[]> {
  const keep = new Set(options.keepIds ?? []);
  const ids = pollIds.filter((id) => !keep.has(id));
  if (!ids.length) return [];
  const { data } = await db.from(CDILV_TABLE.polls).select("id, title, status").in("id", ids);
  const found = new Map((data ?? []).map((p) => [p.id as string, p as { id: string; title: string; status: string }]));
  const errors: string[] = [];
  for (const id of ids) {
    const poll = found.get(id);
    if (!poll) errors.push("Có chương trình bình chọn không còn tồn tại.");
    else if (poll.status !== "closed") errors.push(`Chương trình “${poll.title}” chưa kết thúc.`);
  }
  const links = await loadActiveRewardLinks(db, ids, options.exceptId);
  for (const id of ids) {
    const link = links.get(id);
    if (link) errors.push(`Danh sách thưởng “${found.get(id)?.title ?? ""}” đã nằm trong đề nghị ${link.code}.`);
  }
  return errors;
}

/** poll id → đề nghị thanh toán còn hiệu lực đi kèm danh sách thưởng – dùng cho trang danh sách chương trình. */
export async function loadPaymentsForRewardPolls(
  db: SupabaseClient,
  pollIds: string[],
): Promise<Map<string, { id: string; code: string; status: PaymentStatus }>> {
  if (!pollIds.length) return new Map();
  return loadActiveRewardLinks(db, pollIds);
}

/** Đề nghị thanh toán (còn hiệu lực) đi kèm danh sách thưởng – số đề nghị đứng đầu nội dung chuyển khoản. */
export async function loadPaymentForRewardPoll(
  db: SupabaseClient,
  pollId: string,
): Promise<{ id: string; code: string; status: PaymentStatus } | null> {
  const links = await loadActiveRewardLinks(db, [pollId]);
  return links.get(pollId) ?? null;
}

/** Người đề nghị = tài khoản đang đăng nhập (họ tên + bộ phận trong hồ sơ). */
export async function loadRequesterProfile(
  db: SupabaseClient,
  userId: string,
): Promise<{ name: string; department: string | null }> {
  const { data } = await db.from(CDILV_TABLE.profiles).select("full_name, department").eq("id", userId).maybeSingle();
  const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
  return { name: clean(data?.full_name), department: clean(data?.department) || null };
}

/** Thông tin người nhận lần trước của người lập – điền sẵn cho đề nghị mới. */
export async function loadLastReceiver(
  db: SupabaseClient,
  userId: string,
): Promise<LastReceiver | null> {
  const { data } = await db
    .from(CDILV_TABLE.paymentRequests)
    .select("receiver_kind, receiver_member_id, receiver_name, receiver_account, receiver_bank, counterparty_id, requester_department")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LastReceiver | null) ?? null;
}

type LastReceiver = Pick<
  PaymentRequestRow,
  | "receiver_kind"
  | "receiver_member_id"
  | "receiver_name"
  | "receiver_account"
  | "receiver_bank"
  | "counterparty_id"
  | "requester_department"
>;

/** Đoàn viên đã duyệt – để chọn người nhận tiền theo tên hoặc mã NV. */
export async function loadPaymentMembers(db: SupabaseClient, includeId?: string | null): Promise<PaymentMember[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.profiles)
    .select("id, full_name, employee_code, department, approval_status")
    .order("full_name", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`Không tải được danh sách đoàn viên: ${error.message}`);
  return (data ?? [])
    .filter((p) => p.approval_status === "approved" || p.id === includeId)
    .map((p) => ({
      id: p.id as string,
      full_name: (p.full_name as string | null) || "Đoàn viên",
      employee_code: (p.employee_code as string | null) ?? null,
      department: (p.department as string | null) ?? null,
    }));
}

export async function loadPaymentMember(db: SupabaseClient, id: string): Promise<PaymentMember | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db
    .from(CDILV_TABLE.profiles)
    .select("id, full_name, employee_code, department")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    full_name: (data.full_name as string | null) || "Đoàn viên",
    employee_code: (data.employee_code as string | null) ?? null,
    department: (data.department as string | null) ?? null,
  };
}

/** Kiểm tra đoàn viên nhận tiền: phải còn tài khoản đã duyệt (trừ khi giữ nguyên người cũ). */
export async function validateReceiverMember(
  db: SupabaseClient,
  id: string | null,
  keepId?: string | null,
): Promise<string | null> {
  if (!id || id === keepId) return null;
  const { data } = await db.from(CDILV_TABLE.profiles).select("approval_status").eq("id", id).maybeSingle();
  if (!data) return "Đoàn viên đã chọn không còn tồn tại.";
  if (data.approval_status !== "approved") return "Đoàn viên đã chọn chưa được duyệt tài khoản.";
  return null;
}

/** Số tài khoản đoàn viên khai trong hồ sơ – ghi nhật ký truy cập dữ liệu nhạy cảm. */
export async function loadPaymentMemberBank(
  db: SupabaseClient,
  actorId: string,
  member: PaymentMember,
): Promise<PaymentMemberBank> {
  const { data, error } = await db
    .from(CDILV_TABLE.memberDetails)
    .select("bank_account_no, bank_name, bank_branch, bank_account_holder")
    .eq("user_id", member.id)
    .maybeSingle();
  if (error) throw new Error(`Không tải được tài khoản ngân hàng: ${error.message}`);
  const { error: logError } = await db.from(CDILV_TABLE.sensitiveAccessLogs).insert({
    actor_id: actorId,
    action: "payment_member_bank",
    target_count: 1,
    target_ids: [member.id],
    reason: `Điền tài khoản nhận tiền cho đề nghị thanh toán: ${member.full_name}`,
    detail: { employeeCode: member.employee_code },
  });
  if (logError) throw logError;
  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    bank_account_no: clean(data?.bank_account_no),
    bank_name: clean(data?.bank_name),
    bank_branch: clean(data?.bank_branch),
    bank_account_holder: clean(data?.bank_account_holder),
  };
}
