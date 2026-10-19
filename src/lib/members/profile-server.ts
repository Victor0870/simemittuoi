import type { SupabaseClient } from "@supabase/supabase-js";
import {
  encryptIdNumber,
  hashIdNumber,
  maskIdNumber,
  normalizeIdNumber,
} from "@/lib/crypto/identity";
import {
  DETAIL_FIELD_LABEL,
  EMPTY_DETAILS,
  GENDER_LABEL,
  MARITAL_STATUS_LABEL,
  PROFILE_POINTS_PER_ITEM,
  formatDateVi,
  normalizeChildren,
  normalizeDetails,
  profileAwardLabel,
  profileCompleteness,
  profileItemFromAwardLabel,
  validateProfile,
  type MemberChild,
  type MemberDetails,
  type MemberProfileData,
  type ProfileChange,
  type ProfileHistoryEntry,
  type ProfileItemKey,
  type ProfileItemStatus,
  type SaveProfilePayload,
} from "@/lib/members/profile-shared";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const DETAIL_COLUMNS =
  "date_of_birth, gender, phone, permanent_address, current_address, marital_status, no_children, bank_account_no, bank_name, bank_branch, bank_account_holder, consent_at, updated_at";

function maskBankAccount(value: string | null): string | null {
  if (!value) return null;
  return value.length <= 4 ? value : `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

function displayValue(field: keyof MemberDetails, value: MemberDetails[keyof MemberDetails]): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (field === "date_of_birth") return formatDateVi(value as string);
  if (field === "gender") return GENDER_LABEL[value as keyof typeof GENDER_LABEL] ?? String(value);
  if (field === "marital_status") {
    return MARITAL_STATUS_LABEL[value as keyof typeof MARITAL_STATUS_LABEL] ?? String(value);
  }
  if (field === "no_children") return value ? "Có" : "Không";
  if (field === "bank_account_no") return maskBankAccount(value as string);
  return String(value);
}

function describeChild(c: MemberChild): string {
  return `${c.full_name} (${formatDateVi(c.date_of_birth)})`;
}

const ALL_PROFILE_AWARD_LABELS = profileCompleteness(EMPTY_DETAILS, false, 0).items.map((i) =>
  profileAwardLabel(i.key),
);

async function loadAwardedItems(db: SupabaseClient, userId: string): Promise<ProfileItemKey[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.scoreEvents)
    .select("award_label")
    .eq("user_id", userId)
    .in("award_label", ALL_PROFILE_AWARD_LABELS);
  if (error) throw error;
  return (data ?? [])
    .map((r) => profileItemFromAwardLabel(r.award_label as string))
    .filter((k): k is ProfileItemKey => k !== null);
}

/** Cộng điểm cho các mục vừa hoàn thành; unique index (user_id, award_label) chặn cộng trùng. */
async function awardProfileItems(
  db: SupabaseClient,
  userId: string,
  actorId: string,
  items: ProfileItemStatus[],
): Promise<ProfileItemStatus[]> {
  const done = items.filter((i) => i.done);
  if (done.length === 0) return [];
  const awarded = new Set(await loadAwardedItems(db, userId));
  const pending = done.filter((i) => !awarded.has(i.key));
  if (pending.length === 0) return [];

  const toRow = (i: ProfileItemStatus) => ({
    user_id: userId,
    points: PROFILE_POINTS_PER_ITEM,
    note: `Hoàn thiện hồ sơ đoàn viên: ${i.label} (+${PROFILE_POINTS_PER_ITEM}đ)`,
    award_label: profileAwardLabel(i.key),
    created_by: actorId,
  });

  const { error } = await db.from(CDILV_TABLE.scoreEvents).insert(pending.map(toRow));
  if (!error) return pending;
  if (error.code !== "23505") throw error;

  const granted: ProfileItemStatus[] = [];
  for (const item of pending) {
    const { error: oneError } = await db.from(CDILV_TABLE.scoreEvents).insert(toRow(item));
    if (!oneError) granted.push(item);
  }
  return granted;
}

export async function loadMemberProfile(
  db: SupabaseClient,
  userId: string,
): Promise<MemberProfileData | null> {
  const [
    { data: user },
    { data: details },
    { data: children },
    { data: identity },
    { data: logs },
    awardedItems,
  ] = await Promise.all([
      db
        .from(CDILV_TABLE.profiles)
        .select("id, full_name, employee_code, department, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
      db.from(CDILV_TABLE.memberDetails).select(DETAIL_COLUMNS).eq("user_id", userId).maybeSingle(),
      db
        .from(CDILV_TABLE.memberChildren)
        .select("id, full_name, date_of_birth, gender, note")
        .eq("member_id", userId)
        .order("date_of_birth", { ascending: true }),
      db
        .from(CDILV_TABLE.memberIdentity)
        .select("id_last4, id_issue_date, id_issue_place")
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from(CDILV_TABLE.memberChangeLogs)
        .select(
          "id, created_at, changed_by, changes, actor:cdilv_profiles!cdilv_member_change_logs_changed_by_fkey ( full_name )",
        )
        .eq("member_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      loadAwardedItems(db, userId),
    ]);

  if (!user) return null;

  const history: ProfileHistoryEntry[] = (logs ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      created_at: string;
      changed_by: string | null;
      changes: ProfileChange[];
      actor: { full_name: string } | { full_name: string }[] | null;
    };
    const actor = Array.isArray(r.actor) ? r.actor[0] : r.actor;
    return {
      id: r.id,
      created_at: r.created_at,
      changed_by_name: actor?.full_name ?? null,
      is_self: r.changed_by === userId,
      changes: Array.isArray(r.changes) ? r.changes : [],
    };
  });

  const d = details as (MemberDetails & { consent_at: string | null; updated_at: string }) | null;

  return {
    user,
    details: d ? normalizeDetails(d) : EMPTY_DETAILS,
    children: (children ?? []) as MemberChild[],
    identity: {
      masked: maskIdNumber(identity?.id_last4),
      issue_date: identity?.id_issue_date ?? null,
      issue_place: identity?.id_issue_place ?? null,
    },
    consentAt: d?.consent_at ?? null,
    updatedAt: d?.updated_at ?? null,
    history,
    awardedItems,
  };
}

export type MemberProfileSummary = {
  id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  date_of_birth: string | null;
  gender: MemberDetails["gender"];
  marital_status: MemberDetails["marital_status"];
  children_count: number;
  has_identity: boolean;
  completeness_done: number;
  completeness_total: number;
  missing: string[];
  updated_at: string | null;
};

/** Tổng hợp hồ sơ của mọi đoàn viên đã duyệt (không chứa CCCD, STK). */
export async function loadMemberProfileSummaries(db: SupabaseClient): Promise<MemberProfileSummary[]> {
  const [{ data: profiles }, { data: details }, { data: children }, { data: identities }] =
    await Promise.all([
      db
        .from(CDILV_TABLE.profiles)
        .select("id, full_name, employee_code, department")
        .eq("approval_status", "approved")
        .order("full_name", { ascending: true }),
      db.from(CDILV_TABLE.memberDetails).select(`user_id, ${DETAIL_COLUMNS}`),
      db.from(CDILV_TABLE.memberChildren).select("member_id"),
      db.from(CDILV_TABLE.memberIdentity).select("user_id"),
    ]);

  const detailsById = new Map(
    (details ?? []).map((d) => [d.user_id as string, d as unknown as MemberDetails & { updated_at: string }]),
  );
  const childCount = new Map<string, number>();
  for (const c of children ?? []) {
    childCount.set(c.member_id, (childCount.get(c.member_id) ?? 0) + 1);
  }
  const identitySet = new Set((identities ?? []).map((i) => i.user_id as string));

  return (profiles ?? []).map((p) => {
    const raw = detailsById.get(p.id);
    const d = raw ? normalizeDetails(raw) : EMPTY_DETAILS;
    const hasIdentity = identitySet.has(p.id);
    const childrenCount = childCount.get(p.id) ?? 0;
    const completeness = profileCompleteness(d, hasIdentity, childrenCount);
    return {
      id: p.id,
      full_name: p.full_name,
      employee_code: p.employee_code,
      department: p.department,
      date_of_birth: d.date_of_birth,
      gender: d.gender,
      marital_status: d.marital_status,
      children_count: childrenCount,
      has_identity: hasIdentity,
      completeness_done: completeness.done,
      completeness_total: completeness.total,
      missing: completeness.missing,
      updated_at: raw?.updated_at ?? null,
    };
  });
}

export type SaveResult =
  | { ok: true; changed: number; awardedPoints: number; awardedLabels: string[] }
  | { ok: false; status: number; errors: string[] };

export async function saveMemberProfile(
  db: SupabaseClient,
  params: { targetId: string; actorId: string; payload: SaveProfilePayload; requireConsent: boolean },
): Promise<SaveResult> {
  const { targetId, actorId, payload, requireConsent } = params;

  const details = normalizeDetails(payload.details ?? {});
  const children = normalizeChildren(Array.isArray(payload.children) ? payload.children : []);
  const identityInput = {
    id_number: normalizeIdNumber(payload.identity?.id_number ?? ""),
    issue_date: (payload.identity?.issue_date ?? "").trim() || null,
    issue_place: (payload.identity?.issue_place ?? "").trim() || null,
  };

  const [{ data: oldDetails }, { data: oldChildren }, { data: oldIdentity }] = await Promise.all([
    db.from(CDILV_TABLE.memberDetails).select(DETAIL_COLUMNS).eq("user_id", targetId).maybeSingle(),
    db
      .from(CDILV_TABLE.memberChildren)
      .select("id, full_name, date_of_birth, gender, note")
      .eq("member_id", targetId),
    db
      .from(CDILV_TABLE.memberIdentity)
      .select("id_number_hash, id_issue_date, id_issue_place")
      .eq("user_id", targetId)
      .maybeSingle(),
  ]);

  const errors = validateProfile(details, children, identityInput, Boolean(oldIdentity));
  const previousConsent = (oldDetails as { consent_at: string | null } | null)?.consent_at ?? null;
  if (requireConsent && !previousConsent && payload.consent !== true) {
    errors.unshift("Vui lòng tick đồng ý cho Công đoàn lưu trữ và sử dụng thông tin cá nhân.");
  }
  const existingChildIds = new Set((oldChildren ?? []).map((c) => c.id as string));
  if (children.some((c) => c.id && !existingChildIds.has(c.id))) {
    errors.push("Dữ liệu con không hợp lệ, vui lòng tải lại trang.");
  }
  if (errors.length > 0) return { ok: false, status: 400, errors };

  const newIdHash = identityInput.id_number ? hashIdNumber(identityInput.id_number) : null;
  const numberChanged = Boolean(newIdHash && newIdHash !== oldIdentity?.id_number_hash);
  if (numberChanged) {
    const { data: dup } = await db
      .from(CDILV_TABLE.memberIdentity)
      .select("user_id")
      .eq("id_number_hash", newIdHash!)
      .neq("user_id", targetId)
      .maybeSingle();
    if (dup) {
      return {
        ok: false,
        status: 409,
        errors: ["Số CCCD này đã được khai ở một tài khoản khác. Vui lòng kiểm tra lại hoặc liên hệ Công đoàn."],
      };
    }
  }

  const now = new Date().toISOString();
  const changes: ProfileChange[] = [];

  // 1. Thông tin cá nhân
  const before = oldDetails ? normalizeDetails(oldDetails as MemberDetails) : EMPTY_DETAILS;
  for (const field of Object.keys(DETAIL_FIELD_LABEL) as (keyof MemberDetails)[]) {
    if (before[field] !== details[field]) {
      changes.push({
        label: DETAIL_FIELD_LABEL[field],
        old: displayValue(field, before[field]),
        new: displayValue(field, details[field]),
      });
    }
  }

  const detailRow = {
    user_id: targetId,
    ...details,
    consent_at: previousConsent ?? (payload.consent === true ? now : null),
    updated_at: now,
    updated_by: actorId,
  };
  const { error: detailError } = await db
    .from(CDILV_TABLE.memberDetails)
    .upsert(detailRow, { onConflict: "user_id" });
  if (detailError) return { ok: false, status: 500, errors: [detailError.message] };
  if (!previousConsent && detailRow.consent_at) {
    changes.push({ label: "Đồng ý xử lý dữ liệu cá nhân", old: null, new: "Đã đồng ý" });
  }

  // 2. Con
  const oldById = new Map((oldChildren ?? []).map((c) => [c.id as string, c as MemberChild]));
  const keepIds = new Set(children.filter((c) => c.id).map((c) => c.id as string));
  const removed = [...oldById.values()].filter((c) => !keepIds.has(c.id as string));
  if (removed.length > 0) {
    const { error } = await db
      .from(CDILV_TABLE.memberChildren)
      .delete()
      .in(
        "id",
        removed.map((c) => c.id as string),
      );
    if (error) return { ok: false, status: 500, errors: [error.message] };
    removed.forEach((c) => changes.push({ label: "Xóa thông tin con", old: describeChild(c), new: null }));
  }
  for (const child of children) {
    const row = {
      full_name: child.full_name,
      date_of_birth: child.date_of_birth,
      gender: child.gender,
      note: child.note,
    };
    if (child.id) {
      const prev = oldById.get(child.id)!;
      const same =
        prev.full_name === row.full_name &&
        prev.date_of_birth === row.date_of_birth &&
        (prev.gender ?? null) === row.gender &&
        (prev.note ?? null) === row.note;
      if (same) continue;
      const { error } = await db
        .from(CDILV_TABLE.memberChildren)
        .update({ ...row, updated_at: now })
        .eq("id", child.id)
        .eq("member_id", targetId);
      if (error) return { ok: false, status: 500, errors: [error.message] };
      changes.push({ label: "Sửa thông tin con", old: describeChild(prev), new: describeChild(child) });
    } else {
      const { error } = await db
        .from(CDILV_TABLE.memberChildren)
        .insert({ ...row, member_id: targetId });
      if (error) return { ok: false, status: 500, errors: [error.message] };
      changes.push({ label: "Thêm thông tin con", old: null, new: describeChild(child) });
    }
  }

  // 3. CCCD
  if (identityInput.id_number || oldIdentity) {
    const update: Record<string, unknown> = {
      id_issue_date: identityInput.issue_date,
      id_issue_place: identityInput.issue_place,
      updated_at: now,
      updated_by: actorId,
    };
    if (numberChanged) {
      update.id_number_enc = encryptIdNumber(identityInput.id_number);
      update.id_number_hash = newIdHash;
      update.id_last4 = identityInput.id_number.slice(-4);
    }

    const issueChanged =
      (oldIdentity?.id_issue_date ?? null) !== identityInput.issue_date ||
      (oldIdentity?.id_issue_place ?? null) !== identityInput.issue_place;

    if (numberChanged || issueChanged) {
      const { error } = oldIdentity
        ? await db.from(CDILV_TABLE.memberIdentity).update(update).eq("user_id", targetId)
        : await db.from(CDILV_TABLE.memberIdentity).insert({ user_id: targetId, ...update });
      if (error) return { ok: false, status: 500, errors: [error.message] };

      if (numberChanged) {
        changes.push({
          label: "Số CCCD",
          old: oldIdentity ? "(đã lưu)" : null,
          new: `********${identityInput.id_number.slice(-4)}`,
        });
      }
      if ((oldIdentity?.id_issue_date ?? null) !== identityInput.issue_date) {
        changes.push({
          label: "Ngày cấp CCCD",
          old: oldIdentity?.id_issue_date ? formatDateVi(oldIdentity.id_issue_date) : null,
          new: identityInput.issue_date ? formatDateVi(identityInput.issue_date) : null,
        });
      }
      if ((oldIdentity?.id_issue_place ?? null) !== identityInput.issue_place) {
        changes.push({
          label: "Nơi cấp CCCD",
          old: oldIdentity?.id_issue_place ?? null,
          new: identityInput.issue_place,
        });
      }
    }
  }

  if (changes.length > 0) {
    const { error } = await db.from(CDILV_TABLE.memberChangeLogs).insert({
      member_id: targetId,
      changed_by: actorId,
      changes,
    });
    if (error) console.error("[member-profile] change log:", error.message);
  }

  let awardedItems: ProfileItemStatus[] = [];
  try {
    const { items } = profileCompleteness(details, Boolean(oldIdentity) || numberChanged, children.length);
    awardedItems = await awardProfileItems(db, targetId, actorId, items);
  } catch (err) {
    console.error("[member-profile] award points:", err instanceof Error ? err.message : err);
  }

  return {
    ok: true,
    changed: changes.length,
    awardedPoints: awardedItems.length * PROFILE_POINTS_PER_ITEM,
    awardedLabels: awardedItems.map((i) => i.label),
  };
}
