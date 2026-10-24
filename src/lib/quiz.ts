import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_RESULT_POST_TEMPLATE,
  DEFAULT_RESULT_POST_TITLE,
  describePointRules,
  formatQuizDate,
  formatQuizDuration,
  pointsForRank,
  type QuizProgramRow,
  type QuizRankingRow,
  type QuizSessionRow,
  type QuizSettings,
  type QuizStatus,
} from "@/lib/quiz-shared";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Thời gian cho phép nộp trễ so với hạn (bù độ trễ mạng). */
export const QUIZ_SUBMIT_GRACE_MS = 15_000;

export const QUIZ_SESSION_COLUMNS =
  "id, program_id, session_key, title, mode, starts_at, ends_at, finalized_at, result_post_id, participants_count, winners_count";

const PROGRAM_COLUMNS = "id, name, description, is_active, created_at";

export async function loadQuizPrograms(db: SupabaseClient): Promise<QuizProgramRow[]> {
  const { data, error } = await db
    .from(CDILV_TABLE.quizPrograms)
    .select(PROGRAM_COLUMNS)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as QuizProgramRow[];
}

export async function loadQuizProgram(db: SupabaseClient, programId: string): Promise<QuizProgramRow | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId)) return null;
  const { data, error } = await db
    .from(CDILV_TABLE.quizPrograms)
    .select(PROGRAM_COLUMNS)
    .eq("id", programId)
    .maybeSingle();
  if (error) throw error;
  return (data as QuizProgramRow | null) ?? null;
}

/** Đọc hết các dòng theo trang (PostgREST giới hạn 1000 dòng mỗi lần). */
export async function selectAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}

export async function loadQuizSettings(db: SupabaseClient, programId: string): Promise<QuizSettings> {
  const { data, error } = await db
    .from(CDILV_TABLE.quizSettings)
    .select("*")
    .eq("program_id", programId)
    .maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_QUIZ_SETTINGS, ...(data ?? {}) } as QuizSettings;
}

function parseHHMM(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function vnParts(date: Date) {
  const d = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    d: d.getUTCDate(),
    weekday: d.getUTCDay(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

function vnInstant(y: number, m: number, d: number, minutes: number) {
  return new Date(Date.UTC(y, m, d, 0, minutes) - VN_OFFSET_MS);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Khung giờ tự động của ngày hôm nay (giờ VN) nếu hiện đang nằm trong khung. */
function currentAutoWindow(settings: QuizSettings, now: Date) {
  const p = vnParts(now);
  const start = parseHHMM(settings.start_time);
  const end = parseHHMM(settings.end_time);
  if (p.weekday !== settings.schedule_weekday || p.minutes < start || p.minutes >= end) {
    return null;
  }
  const ymd = `${p.y}-${pad2(p.m + 1)}-${pad2(p.d)}`;
  return {
    key: `auto-${ymd}`,
    title: `Thi trắc nghiệm tuần ${pad2(p.d)}/${pad2(p.m + 1)}/${p.y}`,
    startsAt: vnInstant(p.y, p.m, p.d, start),
    endsAt: vnInstant(p.y, p.m, p.d, end),
  };
}

export function nextAutoStart(settings: QuizSettings, now: Date): Date | null {
  if (settings.schedule_mode !== "auto") return null;
  const p = vnParts(now);
  const start = parseHHMM(settings.start_time);
  for (let i = 0; i <= 7; i += 1) {
    const day = vnParts(new Date(Date.UTC(p.y, p.m, p.d + i, 12) - VN_OFFSET_MS));
    if (day.weekday !== settings.schedule_weekday) continue;
    const candidate = vnInstant(day.y, day.m, day.d, start);
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
}

/** Tạo đợt thi tự động (nếu đang trong khung giờ) và trả về đợt thi đang mở. */
export async function ensureCurrentSession(
  db: SupabaseClient,
  programId: string,
  settings: QuizSettings,
  now = new Date(),
): Promise<QuizSessionRow | null> {
  if (settings.schedule_mode === "auto") {
    const win = currentAutoWindow(settings, now);
    if (win) {
      const { error } = await db.from(CDILV_TABLE.quizSessions).upsert(
        {
          program_id: programId,
          session_key: win.key,
          title: win.title,
          mode: "auto",
          starts_at: win.startsAt.toISOString(),
          ends_at: win.endsAt.toISOString(),
        },
        { onConflict: "program_id,session_key", ignoreDuplicates: true },
      );
      if (error) throw error;
    }
  }

  const nowIso = now.toISOString();
  const { data, error } = await db
    .from(CDILV_TABLE.quizSessions)
    .select(QUIZ_SESSION_COLUMNS)
    .eq("program_id", programId)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as QuizSessionRow | null) ?? null;
}

type AttemptForRanking = {
  user_id: string;
  status: string;
  correct_count: number | null;
  total_questions: number;
  duration_ms: number | null;
  started_at: string;
};

function isBetter(a: AttemptForRanking, b: AttemptForRanking) {
  const ac = a.correct_count ?? 0;
  const bc = b.correct_count ?? 0;
  if (ac !== bc) return ac > bc;
  const ad = a.duration_ms ?? Number.MAX_SAFE_INTEGER;
  const bd = b.duration_ms ?? Number.MAX_SAFE_INTEGER;
  if (ad !== bd) return ad < bd;
  return new Date(a.started_at).getTime() < new Date(b.started_at).getTime();
}

/**
 * Xếp hạng một đợt thi: mỗi người lấy lượt tốt nhất (đúng nhiều nhất → nhanh nhất → làm trước).
 * Chỉ người đúng hết mới vào bảng xếp hạng; bằng thời gian thì ai làm trước xếp trên.
 */
export async function computeSessionRanking(
  db: SupabaseClient,
  sessionId: string,
  settings: QuizSettings,
) {
  const { data, error } = await db
    .from(CDILV_TABLE.quizAttempts)
    .select("user_id, status, correct_count, total_questions, duration_ms, started_at")
    .eq("session_id", sessionId)
    .neq("status", "in_progress");
  if (error) throw error;

  const attempts = (data ?? []) as AttemptForRanking[];
  const participants = new Set(attempts.map((a) => a.user_id));
  const best = new Map<string, AttemptForRanking>();
  for (const a of attempts) {
    if (a.status !== "submitted") continue;
    const cur = best.get(a.user_id);
    if (!cur || isBetter(a, cur)) best.set(a.user_id, a);
  }

  const perfect = [...best.values()]
    .filter((a) => a.total_questions > 0 && a.correct_count === a.total_questions)
    .sort((a, b) => {
      const d = (a.duration_ms ?? 0) - (b.duration_ms ?? 0);
      if (d !== 0) return d;
      return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
    });

  const profiles = new Map<string, { full_name: string; department: string | null; avatar_url: string | null }>();
  if (perfect.length > 0) {
    const { data: rows, error: pErr } = await db
      .from(CDILV_TABLE.profiles)
      .select("id, full_name, department, avatar_url")
      .in(
        "id",
        perfect.map((a) => a.user_id),
      );
    if (pErr) throw pErr;
    for (const r of rows ?? []) profiles.set(r.id, r);
  }

  const ranking: QuizRankingRow[] = perfect.map((a, i) => {
    const p = profiles.get(a.user_id);
    return {
      rank: i + 1,
      user_id: a.user_id,
      full_name: p?.full_name ?? "Đoàn viên",
      department: p?.department ?? null,
      avatar_url: p?.avatar_url ?? null,
      duration_ms: a.duration_ms ?? 0,
      started_at: a.started_at,
      points: pointsForRank(i + 1, settings),
    };
  });

  return { ranking, participantsCount: participants.size };
}

function renderTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(key).join(value),
    template,
  );
}

function buildResultLines(ranking: QuizRankingRow[], totalQuestions: number) {
  if (ranking.length === 0) {
    return `Đợt thi này chưa có đoàn viên nào trả lời đúng cả ${totalQuestions} câu.`;
  }
  const medal = ["🥇", "🥈", "🥉"];
  return ranking
    .map((r) => {
      const prefix = medal[r.rank - 1] ?? "•";
      const dept = r.department ? ` (${r.department})` : "";
      return `${prefix} Hạng ${r.rank}: ${r.full_name}${dept} – ${formatQuizDuration(r.duration_ms)} – +${r.points} điểm`;
    })
    .join("\n");
}

/**
 * Tổng kết đợt thi: cộng điểm sự kiện cho người đúng hết và đăng bài kết quả từ mẫu soạn sẵn.
 * Chỉ một tiến trình giành được quyền tổng kết nhờ cập nhật có điều kiện finalized_at.
 */
export async function finalizeQuizSession(
  db: SupabaseClient,
  session: QuizSessionRow,
  settings: QuizSettings,
  actorId: string | null,
) {
  const { data: claimed, error: claimErr } = await db
    .from(CDILV_TABLE.quizSessions)
    .update({ finalized_at: new Date().toISOString() })
    .eq("id", session.id)
    .is("finalized_at", null)
    .select("id")
    .maybeSingle();
  if (claimErr) throw claimErr;
  if (!claimed) {
    return { ok: false as const, error: "Đợt thi này đã được tổng kết." };
  }

  try {
    const { ranking, participantsCount } = await computeSessionRanking(db, session.id, settings);
    const dateText = formatQuizDate(session.starts_at);
    const awardLabel = `quiz_${session.id}`;

    const { data: existing, error: exErr } = await db
      .from(CDILV_TABLE.scoreEvents)
      .select("user_id")
      .eq("award_label", awardLabel);
    if (exErr) throw exErr;
    const awarded = new Set((existing ?? []).map((e) => e.user_id));

    const scoreRows = ranking
      .filter((r) => !awarded.has(r.user_id) && r.points > 0)
      .map((r) => ({
        user_id: r.user_id,
        points: r.points,
        note: `Thi trắc nghiệm ${dateText} – Hạng ${r.rank} (+${r.points}đ)`,
        award_label: awardLabel,
        created_by: actorId,
      }));
    if (scoreRows.length > 0) {
      const { error: insErr } = await db.from(CDILV_TABLE.scoreEvents).insert(scoreRows);
      if (insErr) throw insErr;
    }

    const values = {
      "{{NGAY}}": dateText,
      "{{TEN_DOT}}": session.title,
      "{{SO_CAU}}": String(settings.questions_per_attempt),
      "{{SO_NGUOI_THAM_GIA}}": String(participantsCount),
      "{{SO_NGUOI_DAT}}": String(ranking.length),
      "{{KET_QUA}}": buildResultLines(ranking, settings.questions_per_attempt),
      "{{CO_CAU_DIEM}}": describePointRules(settings),
    };
    const title = renderTemplate(settings.result_post_title?.trim() || DEFAULT_RESULT_POST_TITLE, values);
    const content = renderTemplate(
      settings.result_post_template?.trim() || DEFAULT_RESULT_POST_TEMPLATE,
      values,
    );

    let postId = session.result_post_id;
    if (!postId) {
      const { data: post, error: postErr } = await db
        .from(CDILV_TABLE.posts)
        .insert({
          title,
          content,
          tag: "Trắc nghiệm",
          tag_tone: "primary",
          author_id: actorId,
          is_active: settings.result_post_publish,
        })
        .select("id")
        .single();
      if (postErr) throw postErr;
      postId = post.id;
    }

    const { error: updErr } = await db
      .from(CDILV_TABLE.quizSessions)
      .update({
        result_post_id: postId,
        participants_count: participantsCount,
        winners_count: ranking.length,
      })
      .eq("id", session.id);
    if (updErr) throw updErr;

    return {
      ok: true as const,
      postId,
      participantsCount,
      winnersCount: ranking.length,
      awardedCount: scoreRows.length,
    };
  } catch (err) {
    await db.from(CDILV_TABLE.quizSessions).update({ finalized_at: null }).eq("id", session.id);
    throw err;
  }
}

/** Tự tổng kết các đợt đã kết thúc (sau khi hết hạn nộp của lượt cuối) nếu bật auto_finalize. */
export async function finalizeDueSessions(
  db: SupabaseClient,
  programId: string,
  settings: QuizSettings,
  now = new Date(),
) {
  if (!settings.auto_finalize) return [];
  const cutoff = new Date(
    now.getTime() - settings.time_limit_seconds * 1000 - QUIZ_SUBMIT_GRACE_MS,
  ).toISOString();
  const { data, error } = await db
    .from(CDILV_TABLE.quizSessions)
    .select(QUIZ_SESSION_COLUMNS)
    .eq("program_id", programId)
    .is("finalized_at", null)
    .lt("ends_at", cutoff)
    .order("ends_at", { ascending: true })
    .limit(3);
  if (error) throw error;

  const results = [];
  for (const session of (data ?? []) as QuizSessionRow[]) {
    results.push(await finalizeQuizSession(db, session, settings, null));
  }
  return results;
}

export async function getQuizStatus(
  db: SupabaseClient,
  programId: string,
  userId: string | null,
  now = new Date(),
): Promise<QuizStatus> {
  const settings = await loadQuizSettings(db, programId);
  try {
    await finalizeDueSessions(db, programId, settings, now);
  } catch (err) {
    console.error("[quiz] auto finalize error:", err);
  }
  const session = await ensureCurrentSession(db, programId, settings, now);

  let attemptsUsed = 0;
  let hasInProgress = false;
  let best: QuizStatus["best"] = null;

  if (session && userId) {
    const { data, error } = await db
      .from(CDILV_TABLE.quizAttempts)
      .select("user_id, status, correct_count, total_questions, duration_ms, started_at, deadline_at")
      .eq("session_id", session.id)
      .eq("user_id", userId);
    if (error) throw error;
    const rows = data ?? [];
    attemptsUsed = rows.length;
    hasInProgress = rows.some(
      (r) =>
        r.status === "in_progress" &&
        new Date(r.deadline_at).getTime() + QUIZ_SUBMIT_GRACE_MS > now.getTime(),
    );
    let top: AttemptForRanking | null = null;
    for (const r of rows as AttemptForRanking[]) {
      if (r.status !== "submitted") continue;
      if (!top || isBetter(r, top)) top = r;
    }
    if (top) {
      best = {
        correctCount: top.correct_count ?? 0,
        total: top.total_questions,
        durationMs: top.duration_ms ?? 0,
      };
    }
  }

  return {
    isOpen: Boolean(session),
    session: session
      ? { id: session.id, title: session.title, startsAt: session.starts_at, endsAt: session.ends_at }
      : null,
    scheduleMode: settings.schedule_mode,
    nextStartAt: session ? null : (nextAutoStart(settings, now)?.toISOString() ?? null),
    questionsPerAttempt: settings.questions_per_attempt,
    maxAttempts: settings.max_attempts,
    timeLimitSeconds: settings.time_limit_seconds,
    attemptsUsed,
    hasInProgress,
    best,
    serverNow: now.toISOString(),
  };
}

/** Đợt thi để hiển thị bảng xếp hạng: đợt đang mở, nếu không thì đợt gần nhất. */
export async function getDisplaySession(db: SupabaseClient, programId: string, now = new Date()) {
  const { data, error } = await db
    .from(CDILV_TABLE.quizSessions)
    .select(QUIZ_SESSION_COLUMNS)
    .eq("program_id", programId)
    .lte("starts_at", now.toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as QuizSessionRow | null) ?? null;
}
