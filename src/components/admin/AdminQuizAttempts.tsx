"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Avatar } from "@/components/ui/Avatar";
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
  rankingBonus?: number | null;
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

  const isPerfectAttempt = (a: AttemptItem) =>
    a.correct_count !== null && a.total_questions > 0 && a.correct_count === a.total_questions;

  const columns: DataTableColumn<AttemptItem>[] = [
    {
      key: "attempt_no",
      header: "Lượt",
      accessor: (a) => `Lượt ${a.attempt_no}`,
      className: "font-bold text-[#173A67] whitespace-nowrap",
    },
    {
      key: "member",
      header: "Đoàn viên",
      accessor: (a) => a.profile.full_name,
      render: (a) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            alt={a.profile.full_name}
            className="h-8 w-8 rounded-full object-cover shrink-0"
            fallback={
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dusty-light text-xs font-bold text-primary">
                {a.profile.full_name.slice(0, 1).toUpperCase()}
              </span>
            }
            size={32}
            src={a.profile.avatar_url}
          />
          <div className="min-w-0">
            <p className="truncate font-bold text-on-surface text-sm">
              {a.profile.full_name}
            </p>
            <p className="truncate text-xs text-on-surface-variant">
              {a.profile.department ?? "—"}{a.profile.employee_code ? ` · MS: ${a.profile.employee_code}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "correct_count",
      header: "Kết quả",
      type: "number",
      render: (a) => {
        const isPerfect = isPerfectAttempt(a);
        return a.correct_count !== null ? (
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${
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
        );
      },
    },
    {
      key: "duration",
      header: "Thời gian",
      type: "number",
      accessor: (a) => (a.duration_ms !== null ? Math.round(a.duration_ms / 1000) : null),
      className: "font-semibold text-on-surface",
      render: (a) => (a.duration_ms !== null ? formatQuizDuration(a.duration_ms) : "—"),
    },
    {
      key: "status",
      header: "Trạng thái",
      type: "enum",
      accessor: (a) => (a.status === "submitted" ? "Đã nộp" : a.status === "in_progress" ? "Đang làm" : "Quá hạn"),
      render: (a) =>
        a.status === "submitted" ? (
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
        ),
    },
    {
      key: "points",
      header: "Điểm thi đua",
      type: "number",
      accessor: (a) =>
        a.awardedPoints === null && !a.rankingBonus ? null : (a.awardedPoints ?? 0) + (a.rankingBonus ?? 0),
      render: (a) => (
        <div className="flex flex-col gap-1 items-start">
          {a.awardedPoints !== null ? (
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              <MaterialIcon className="text-[14px] text-amber-600" name="stars" />
              +{a.awardedPoints}đ (Lượt thi)
            </span>
          ) : a.status === "submitted" ? (
            <span className="text-xs text-on-surface-variant/70">Đã nộp</span>
          ) : (
            <span className="text-xs text-on-surface-variant/60">0đ</span>
          )}

          {a.rankingBonus ? (
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              <MaterialIcon className="text-[12px] text-emerald-600" name="emoji_events" />
              +{a.rankingBonus}đ (Top)
            </span>
          ) : isPerfectAttempt(a) ? (
            <span className="text-[11px] text-on-surface-variant italic">Chờ tổng kết Top</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "started_at",
      header: "Bắt đầu / Nộp bài",
      type: "date",
      className: "text-xs text-on-surface-variant",
      render: (a) => (
        <>
          <div>{formatQuizTime(a.started_at)}</div>
          {a.submitted_at ? (
            <div className="text-[11px] text-on-surface-variant/70">
              Nộp: {formatQuizTime(a.submitted_at)}
            </div>
          ) : null}
        </>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      filterable: false,
      // Luôn thấy cột thao tác: dính mép phải nếu bảng phải cuộn ngang
      className:
        "sticky right-0 z-[1] whitespace-nowrap bg-surface-container-lowest text-right shadow-[inset_1px_0_0_rgb(0_0_0/0.06)]",
      headerClassName: "sticky right-0 z-20 bg-[#ecf4ff] text-right",
      render: (a) => (
        <button
          type="button"
          aria-label="Xóa lượt"
          disabled={busyId === a.id}
          onClick={() => void handleDeleteAttempt(a)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50/60 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          title="Xóa lượt thi này và thu hồi điểm nếu đã tổng kết"
        >
          {busyId === a.id ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-700 border-t-transparent" />
          ) : (
            <MaterialIcon className="text-[18px]" name="delete" />
          )}
        </button>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-2 lg:min-h-0 lg:flex-1">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#d2dfe9] bg-white px-3 py-2">
        <h2
          className="flex items-center gap-2 text-sm font-bold text-[#173A67]"
          title="Xem chi tiết bài nộp, cho phép xóa lượt thi thử nghiệm hoặc hủy kết quả vi phạm (tự động thu hồi điểm nếu có)."
        >
          <MaterialIcon className="text-[20px]" name="ballot" />
          Quản lý lượt làm bài của thành viên
        </h2>

        <div className="flex min-w-0 items-center gap-2 sm:ml-auto">
          <select
            className="min-w-0 rounded-lg border border-outline-variant bg-white px-2.5 py-1 text-xs font-semibold text-on-surface outline-none focus:border-[#173A67]"
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
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-outline-variant bg-white px-2.5 py-1 text-xs font-bold text-[#173A67] hover:bg-surface-container-low transition disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <MaterialIcon className={`text-[16px] ${loading ? "animate-spin" : ""}`} name="refresh" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error ? (
        <p className="shrink-0 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="shrink-0 rounded-xl bg-[#D9F2EC] px-3 py-1.5 text-sm font-semibold text-[#173A67]">
          {success}
        </p>
      ) : null}

      {loading ? (
        <div className="flex shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest py-8 text-on-surface-variant">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-2 text-sm font-semibold">Đang tải danh sách lượt thi...</span>
        </div>
      ) : attempts.length === 0 ? (
        <div className="shrink-0 rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant">
          <MaterialIcon className="mx-auto mb-1 text-[28px] text-on-surface-variant/40" name="inbox" />
          <p className="font-semibold text-on-surface">Chưa có ai tham gia lượt thi nào trong đợt này.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:min-h-0 lg:flex-1">
          <DataTable
            columns={columns}
            defaultPageSize={10}
            density="compact"
            fill
            rowKey={(a) => a.id}
            rows={attempts}
          />
        </div>
      )}
    </section>
  );
}
