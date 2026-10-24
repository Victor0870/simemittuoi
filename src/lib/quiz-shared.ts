/** Kiểu dữ liệu, mặc định và hàm định dạng dùng chung cho server và client của tính năng Thi trắc nghiệm. */

export const QUIZ_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Chương trình "Trắc nghiệm tuần" (id cố định trong supabase/migration_quiz_programs.sql). */
export const WEEKLY_QUIZ_PROGRAM_ID = "3f0e9a4c-2b1d-4c7e-8a5f-6d2b1c0e7a01";

export type QuizProgramRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export const WEEKDAY_LABELS = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
] as const;

export type QuizSettings = {
  schedule_mode: "auto" | "manual";
  schedule_weekday: number;
  start_time: string;
  end_time: string;
  questions_per_attempt: number;
  max_attempts: number;
  time_limit_seconds: number;
  points_per_attempt: number;
  base_points: number;
  top1_bonus: number;
  top2_5_bonus: number;
  top6_10_bonus: number;
  auto_finalize: boolean;
  result_post_title: string | null;
  result_post_template: string | null;
  result_post_publish: boolean;
};

export type QuizQuestionRow = {
  id: string;
  content: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
  created_at: string;
};

export type QuizSessionRow = {
  id: string;
  program_id: string;
  session_key: string;
  title: string;
  mode: "auto" | "manual";
  starts_at: string;
  ends_at: string;
  finalized_at: string | null;
  result_post_id: string | null;
  participants_count: number | null;
  winners_count: number | null;
};

export type QuizRankingRow = {
  rank: number;
  user_id: string;
  full_name: string;
  department: string | null;
  avatar_url: string | null;
  duration_ms: number;
  started_at: string;
  points: number;
};

export type QuizStatus = {
  isOpen: boolean;
  session: { id: string; title: string; startsAt: string; endsAt: string } | null;
  scheduleMode: "auto" | "manual";
  nextStartAt: string | null;
  questionsPerAttempt: number;
  maxAttempts: number;
  timeLimitSeconds: number;
  attemptsUsed: number;
  hasInProgress: boolean;
  best: { correctCount: number; total: number; durationMs: number } | null;
  serverNow: string;
};

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  schedule_mode: "auto",
  schedule_weekday: 1,
  start_time: "21:00",
  end_time: "22:00",
  questions_per_attempt: 5,
  max_attempts: 5,
  time_limit_seconds: 120,
  points_per_attempt: 2,
  base_points: 5,
  top1_bonus: 5,
  top2_5_bonus: 3,
  top6_10_bonus: 1,
  auto_finalize: true,
  result_post_title: null,
  result_post_template: null,
  result_post_publish: true,
};

export const DEFAULT_RESULT_POST_TITLE = "Kết quả Thi trắc nghiệm hàng tuần – {{NGAY}}";

export const DEFAULT_RESULT_POST_TEMPLATE = `Ban Chấp hành Công đoàn CDILV trân trọng thông báo kết quả cuộc thi trắc nghiệm hàng tuần ngày {{NGAY}}.

Tổng số đoàn viên tham gia: {{SO_NGUOI_THAM_GIA}} người.
Số đoàn viên trả lời đúng cả {{SO_CAU}} câu: {{SO_NGUOI_DAT}} người.

BẢNG THÀNH TÍCH
{{KET_QUA}}

Cơ cấu điểm thưởng: {{CO_CAU_DIEM}} Nếu thời gian bằng nhau, ai làm bài trước được xếp hạng cao hơn.

Xin chúc mừng các đoàn viên đạt thành tích và hẹn gặp lại mọi người ở cuộc thi tuần sau!`;

export const QUIZ_TEMPLATE_PLACEHOLDERS = [
  { key: "{{NGAY}}", label: "Ngày thi (dd/mm/yyyy)" },
  { key: "{{TEN_DOT}}", label: "Tên đợt thi" },
  { key: "{{SO_CAU}}", label: "Số câu mỗi lượt" },
  { key: "{{SO_NGUOI_THAM_GIA}}", label: "Số người tham gia" },
  { key: "{{SO_NGUOI_DAT}}", label: "Số người đúng hết" },
  { key: "{{KET_QUA}}", label: "Bảng thành tích (hạng, tên, thời gian, điểm)" },
  { key: "{{CO_CAU_DIEM}}", label: "Câu mô tả cơ cấu điểm theo cài đặt" },
] as const;

export function describePointRules(
  s: Pick<QuizSettings, "questions_per_attempt" | "base_points" | "top1_bonus" | "top2_5_bonus" | "top6_10_bonus"> & {
    points_per_attempt?: number;
  },
) {
  const attemptText = (s.points_per_attempt ?? 2) > 0 ? `mỗi lượt thi hoàn thành được cộng ${s.points_per_attempt ?? 2} điểm; ` : "";
  return `${attemptText}đoàn viên trả lời đúng cả ${s.questions_per_attempt} câu được cộng ${s.base_points} điểm; Hạng 1 được cộng thêm ${s.top1_bonus} điểm, Hạng 2–5 cộng thêm ${s.top2_5_bonus} điểm, Hạng 6–10 cộng thêm ${s.top6_10_bonus} điểm.`;
}

/** Điểm sự kiện cho người đúng hết theo hạng: điểm cơ bản + thưởng thêm Top 1 / 2–5 / 6–10. */
export function pointsForRank(rank: number, s: Pick<QuizSettings, "base_points" | "top1_bonus" | "top2_5_bonus" | "top6_10_bonus">) {
  if (rank === 1) return s.base_points + s.top1_bonus;
  if (rank <= 5) return s.base_points + s.top2_5_bonus;
  if (rank <= 10) return s.base_points + s.top6_10_bonus;
  return s.base_points;
}

export function formatQuizDuration(ms: number) {
  const totalTenths = Math.max(0, Math.round(ms / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = (totalTenths % 600) / 10;
  const secText = seconds.toFixed(1).replace(".", ",");
  return minutes > 0 ? `${minutes} phút ${secText} giây` : `${secText} giây`;
}

export function formatQuizDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: QUIZ_TIMEZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatQuizTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    timeZone: QUIZ_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatQuizDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    timeZone: QUIZ_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
