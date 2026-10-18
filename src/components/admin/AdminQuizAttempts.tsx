"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatQuizDate, formatQuizDateTime, formatQuizDuration, formatQuizTime, type QuizSessionRow } from "@/lib/quiz-shared";

type AttemptItem = {
  id: string;
  session_id: string;
  user_id: string;
  attempt_no: number;
  total_questions: number;
  correct_count: number | null;
  status: "in_progress" | "submitted" | "expired";
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  duration_ms: number | null;
  profile: {
    full_name: string;
    department: string | null;
    avatar_url: string | null;
    employee_code?: string | null;
  };
  awardedPoints: number | null;
};

type Props = {
  sessions: QuizSessionRow[];
  initialSessionId?: string | null;
};

export function AdminQuizAttempts({ sessions, initialSessionId }: Props) {
  const router = useRouter();
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    initialSessionId ?? (sessions[0]?.id || ""),
  );
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadAttempts(sessionId: string) {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quiz/attempts?sessionId=${sessionId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể tải danh sách lượt thi.");
      setAttempts(json.attempts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách lượt thi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedSessionId) {
      void loadAttempts(selectedSessionId);
    }
  }, [selectedSessionId]);

  async function handleDeleteAttempt(a: AttemptItem) {
    if (
      !window.confirm(
        `Xác nhận xóa lượt thi số ${a.attempt_no} của đoàn viên "${a.profile.full_name}"? Lượt thi này sẽ bị xóa hoàn toàn khỏi hệ thống (và thu hồi điểm nếu đã tổng kết).`,
      )
    ) {
      return;
    }

    setBusyId(a.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/quiz/attempts?attemptId=${a.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể xóa lượt thi.");
      setSuccess(`Đã xóa lượt thi số ${a.attempt_no} của ${a.profile.full_name}.`);
      await loadAttempts(selectedSessionId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa lượt thi.");
    } finally {
      setBusyId(null);
    }
  }

  if (sessions.length === 0) {
    return null;
  }

  const currentSession = sessions.find((s) => s.id === selectedSessionId) ?? sessions[0];

  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-title-md font-bold text-[#173A67]">
            <MaterialIcon className="text-[22px]" name="ballot" />
            Quản lý lượt làm bài của thành viên
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Xem chi tiết bài nộp, cho phép xóa lượt thi thử nghiệm hoặc hủy kết quả vi phạm (tự động thu hồi điểm nếu có).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-on-surface outline-none focus:border-[#173A67]"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({formatQuizDate(s.starts_at)})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadAttempts(selectedSessionId)}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-xl border border-outline-variant bg-white px-2.5 py-1.5 text-xs font-bold text-[#173A67] hover:bg-surface-container-low transition disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <MaterialIcon className={`text-[16px] ${loading ? "animate-spin" : ""}`} name="refresh" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-3 rounded-xl bg-[#D9F2EC] px-4 py-2 text-sm font-semibold text-[#173A67]">
          {success}
        </p>
      ) : null}

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-on-surface-variant">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm font-semibold">Đang tải danh sách lượt thi...</span>
          </div>
        ) : attempts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant">
            <MaterialIcon className="mx-auto mb-1 text-[28px] text-on-surface-variant/40" name="inbox" />
            <p className="font-semibold text-on-surface">Chưa có ai tham gia lượt thi nào trong đợt này.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-on-surface-variant">
                <tr className="border-b border-outline-variant">
                  <th className="py-2.5 pr-3">Lượt</th>
                  <th className="py-2.5 pr-3">Đoàn viên</th>
                  <th className="py-2.5 pr-3">Kết quả</th>
                  <th className="py-2.5 pr-3">Thời gian</th>
                  <th className="py-2.5 pr-3">Trạng thái</th>
                  <th className="py-2.5 pr-3">Điểm thi đua</th>
                  <th className="py-2.5 pr-3">Bắt đầu / Nộp bài</th>
                  <th className="py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/70">
                {attempts.map((a) => {
                  const isPerfect =
                    a.correct_count !== null &&
                    a.total_questions > 0 &&
                    a.correct_count === a.total_questions;
                  return (
                    <tr key={a.id} className="hover:bg-surface-container-low/50 transition">
                      <td className="py-3 pr-3 font-bold text-[#173A67]">
                        Lượt {a.attempt_no}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          {a.profile.avatar_url ? (
                            <img
                              alt={a.profile.full_name}
                              className="h-8 w-8 rounded-full object-cover shrink-0"
                              src={a.profile.avatar_url}
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dusty-light text-xs font-bold text-primary">
                              {a.profile.full_name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-bold text-on-surface text-sm">
                              {a.profile.full_name}
                            </p>
                            <p className="truncate text-xs text-on-surface-variant">
                              {a.profile.department ?? "—"}{a.profile.employee_code ? ` · MS: ${a.profile.employee_code}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        {a.correct_count !== null ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                              isPerfect
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-surface-container text-on-surface"
                            }`}
                          >
                            <MaterialIcon
                              className={`text-[14px] ${isPerfect ? "text-emerald-600" : ""}`}
                              name={isPerfect ? "check_circle" : "quiz"}
                            />
                            {a.correct_count}/{a.total_questions} câu
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant italic">Đang làm</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-on-surface">
                        {a.duration_ms !== null ? formatQuizDuration(a.duration_ms) : "—"}
                      </td>
                      <td className="py-3 pr-3">
                        {a.status === "submitted" ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                            Đã nộp
                          </span>
                        ) : a.status === "in_progress" ? (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                            Đang làm
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                            Quá hạn
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {a.awardedPoints !== null ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <MaterialIcon className="text-[14px] text-amber-600" name="stars" />
                            +{a.awardedPoints}đ (Đã cộng)
                          </span>
                        ) : isPerfect ? (
                          <span className="text-xs text-on-surface-variant">Chờ tổng kết</span>
                        ) : (
                          <span className="text-xs text-on-surface-variant/60">0đ</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs text-on-surface-variant">
                        <div>{formatQuizTime(a.started_at)}</div>
                        {a.submitted_at ? (
                          <div className="text-[11px] text-on-surface-variant/70">
                            Nộp: {formatQuizTime(a.submitted_at)}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => void handleDeleteAttempt(a)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/60 px-2.5 py-1 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          title="Xóa lượt thi này và thu hồi điểm nếu đã tổng kết"
                        >
                          {busyId === a.id ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-700 border-t-transparent" />
                          ) : (
                            <MaterialIcon className="text-[15px]" name="delete" />
                          )}
                          <span>Xóa lượt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
