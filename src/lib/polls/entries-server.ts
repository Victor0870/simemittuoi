import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { normalizeEmployeeCode } from "@/lib/polls/judge-access";
import { formatPollTime, getPollPhase } from "@/lib/polls/phase";
import type { EntryApprovalStatus } from "@/lib/polls/vote-mode";

export const MAX_ENTRY_IMAGES = 3;
export const MAX_ENTRY_MEMBERS = 20;
export const MAX_ACTIVE_SUBMISSIONS = 5;
const MAX_IMAGE_DATA_URL_LENGTH = 2_000_000;
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function parseSubmissionDeadline(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Hạn nộp bài không hợp lệ." };
  return { ok: true, value: date.toISOString() };
}

export type Submitter = { userId: string; fullName: string | null; employeeCode: string | null };

/** Người nộp bài phải là đoàn viên đã duyệt đang đăng nhập. */
export async function getSubmitter(): Promise<{ submitter: Submitter } | { error: string; status: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập tài khoản đoàn viên để nộp bài.", status: 401 };

  const { data: profile } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("approval_status, full_name, employee_code")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.approval_status !== "approved") {
    return { error: "Tài khoản đoàn viên chưa được duyệt nên chưa nộp bài được.", status: 403 };
  }
  return {
    submitter: {
      userId: user.id,
      fullName: profile?.full_name?.trim() || null,
      employeeCode: normalizeEmployeeCode(profile?.employee_code),
    },
  };
}

/** Lý do không nộp / sửa bài được lúc này, hoặc null nếu đang trong thời gian nhận bài. */
export function submissionWindowError(poll: Record<string, any>): string | null {
  if (poll.submission_mode !== "player") return "Chương trình này do Ban tổ chức nhập bài thi.";
  if (poll.is_active === false) return "Chương trình đang tạm ngưng (Inactive).";
  const phase = getPollPhase({ status: poll.status, opensAt: poll.opens_at, votingEndsAt: poll.voting_ends_at });
  if (phase === "closed" || phase === "ended") return "Chương trình đã kết thúc, không nhận bài nữa.";
  if (poll.submission_deadline && new Date(poll.submission_deadline).getTime() <= Date.now()) {
    return `Đã hết hạn nộp bài (${formatPollTime(poll.submission_deadline)}).`;
  }
  return null;
}

export type EntryInput = {
  title: string;
  description: string | null;
  imageUrls: string[];
  members: { full_name: string; employee_code: string }[];
};

function isAllowedImage(value: string): boolean {
  if (value.startsWith("data:")) {
    return value.length <= MAX_IMAGE_DATA_URL_LENGTH && IMAGE_DATA_URL_RE.test(value);
  }
  return /^https:\/\/\S+$/i.test(value) && value.length <= 2000;
}

/** Kiểm tra bài nộp; thành viên phải có mã trong danh sách nhân viên đang làm, họ tên lấy theo danh sách. */
export async function validateEntryInput(
  db: SupabaseClient,
  body: Record<string, any>,
): Promise<{ ok: true; value: EntryInput } | { ok: false; error: string }> {
  const title = String(body?.title ?? "").trim();
  if (!title) return { ok: false, error: "Vui lòng nhập tên bài thi." };
  if (title.length > 200) return { ok: false, error: "Tên bài thi tối đa 200 ký tự." };

  const description = String(body?.description ?? "").trim();
  if (description.length > 3000) return { ok: false, error: "Mô tả tối đa 3000 ký tự." };

  const rawImages: unknown[] = Array.isArray(body?.imageUrls) ? body.imageUrls : [];
  if (rawImages.length > MAX_ENTRY_IMAGES) {
    return { ok: false, error: `Tối đa ${MAX_ENTRY_IMAGES} ảnh cho mỗi bài thi.` };
  }
  const imageUrls = rawImages.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (!imageUrls.every(isAllowedImage)) {
    return { ok: false, error: "Ảnh không hợp lệ hoặc quá lớn. Vui lòng chọn lại ảnh." };
  }

  const rawMembers: unknown[] = Array.isArray(body?.members) ? body.members : [];
  const codes: string[] = [];
  for (const m of rawMembers) {
    const code = normalizeEmployeeCode((m as { employeeCode?: unknown })?.employeeCode);
    if (code && !codes.includes(code)) codes.push(code);
  }
  if (codes.length === 0) return { ok: false, error: "Vui lòng chọn ít nhất 1 thành viên (theo mã nhân viên)." };
  if (codes.length > MAX_ENTRY_MEMBERS) {
    return { ok: false, error: `Tối đa ${MAX_ENTRY_MEMBERS} thành viên cho mỗi bài thi.` };
  }

  const { data: employees, error } = await db
    .from(CDILV_TABLE.employeeWhitelist)
    .select("employee_code, full_name, is_active")
    .range(0, 4999);
  if (error) throw error;
  const nameByCode = new Map<string, { code: string; name: string }>();
  for (const e of employees ?? []) {
    if (e.is_active === false) continue;
    const code = normalizeEmployeeCode(e.employee_code);
    if (code) nameByCode.set(code, { code: String(e.employee_code).trim(), name: String(e.full_name ?? "").trim() });
  }

  const members: EntryInput["members"] = [];
  for (const code of codes) {
    const found = nameByCode.get(code);
    if (!found) return { ok: false, error: `Mã nhân viên ${code} không có trong danh sách nhân viên.` };
    members.push({ full_name: found.name || code, employee_code: found.code });
  }

  return { ok: true, value: { title, description: description || null, imageUrls, members } };
}

export type EntryView = {
  id: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  status: EntryApprovalStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  submittedBy: string | null;
  submittedByName: string | null;
  members: { fullName: string; employeeCode: string | null }[];
};

export async function loadEntries(
  db: SupabaseClient,
  rows: Record<string, any>[],
): Promise<EntryView[]> {
  const ids = rows.map((r) => String(r.id));
  const submitterIds = [...new Set(rows.map((r) => r.submitted_by).filter(Boolean))];
  const [{ data: members, error: membersError }, { data: profiles, error: profilesError }] = await Promise.all([
    ids.length
      ? db.from(CDILV_TABLE.pollOptionMembers).select("option_id, full_name, employee_code").in("option_id", ids)
      : Promise.resolve({ data: [], error: null }),
    submitterIds.length
      ? db.from(CDILV_TABLE.profiles).select("id, full_name").in("id", submitterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (membersError) throw membersError;
  if (profilesError) throw profilesError;

  const nameById = new Map((profiles ?? []).map((p: any) => [String(p.id), p.full_name as string | null]));
  const membersByOption = new Map<string, EntryView["members"]>();
  for (const m of members ?? []) {
    const list = membersByOption.get(String(m.option_id)) ?? [];
    list.push({ fullName: m.full_name, employeeCode: m.employee_code });
    membersByOption.set(String(m.option_id), list);
  }

  return rows.map((r) => ({
    id: String(r.id),
    title: r.title,
    description: r.description ?? null,
    imageUrls: Array.isArray(r.image_urls) ? r.image_urls : [],
    status: r.approval_status as EntryApprovalStatus,
    reviewNote: r.review_note ?? null,
    submittedAt: r.submitted_at ?? null,
    reviewedAt: r.reviewed_at ?? null,
    submittedBy: r.submitted_by ?? null,
    submittedByName: r.submitted_by ? nameById.get(String(r.submitted_by)) ?? null : null,
    members: membersByOption.get(String(r.id)) ?? [],
  }));
}
