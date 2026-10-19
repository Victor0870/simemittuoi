import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export function normalizeEmployeeCode(raw: unknown): string | null {
  const code = String(raw ?? "").trim().toUpperCase();
  return code.length > 0 ? code : null;
}

export function judgeCodesFromPoll(poll: {
  has_judges?: boolean | null;
  judge_list?: unknown;
}): Set<string> {
  if (!poll.has_judges) return new Set();

  let rawList: unknown[] = [];
  if (Array.isArray(poll.judge_list)) {
    rawList = poll.judge_list;
  } else if (typeof poll.judge_list === "string") {
    rawList = JSON.parse(poll.judge_list || "[]");
  }

  return new Set(
    rawList
      .map((item) => normalizeEmployeeCode((item as { employeeCode?: unknown })?.employeeCode))
      .filter((code): code is string => Boolean(code)),
  );
}

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readJudgeToken(db: SupabaseClient, pollId: string): Promise<string | null> {
  const { data, error } = await db
    .from(CDILV_TABLE.pollJudgeAccess)
    .select("token")
    .eq("poll_id", pollId)
    .maybeSingle();
  if (error) throw error;
  return data?.token ? String(data.token) : null;
}

export async function ensureJudgeToken(db: SupabaseClient, pollId: string): Promise<string> {
  const existing = await readJudgeToken(db, pollId);
  if (existing) return existing;

  const token = crypto.randomUUID();
  const { error } = await db.from(CDILV_TABLE.pollJudgeAccess).insert({
    poll_id: pollId,
    token,
  });
  if (!error) return token;

  const again = await readJudgeToken(db, pollId);
  if (again) return again;
  throw error;
}

export async function isValidJudgeToken(
  db: SupabaseClient,
  pollId: string,
  raw: unknown,
): Promise<boolean> {
  const token = String(raw ?? "").trim();
  if (!TOKEN_RE.test(token)) return false;

  const stored = await readJudgeToken(db, pollId);
  if (!stored || !TOKEN_RE.test(stored)) return false;

  return crypto.timingSafeEqual(Buffer.from(token.toLowerCase()), Buffer.from(stored.toLowerCase()));
}

export async function approvedAccountOwnsCode(db: SupabaseClient, code: string): Promise<boolean> {
  const { data, error } = await db
    .from(CDILV_TABLE.profiles)
    .select("employee_code, approval_status")
    .ilike("employee_code", code);
  if (error) throw error;

  return (data ?? []).some(
    (row) => row.approval_status === "approved" && normalizeEmployeeCode(row.employee_code) === code,
  );
}
