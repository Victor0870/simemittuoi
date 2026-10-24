"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  DEFAULT_RESULT_POST_TEMPLATE,
  DEFAULT_RESULT_POST_TITLE,
  QUIZ_TEMPLATE_PLACEHOLDERS,
  WEEKDAY_LABELS,
  formatQuizDate,
  formatQuizDateTime,
  formatQuizTime,
  type QuizSessionRow,
  type QuizSettings,
} from "@/lib/quiz-shared";

type Props = {
  settings: QuizSettings;
  currentSession: QuizSessionRow | null;
  sessions: QuizSessionRow[];
  nextStartAt: string | null;
  questionsCount: number;
  serverNow: string;
};

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-[#173A67]";

type NumberField =
  | "questions_per_attempt"
  | "max_attempts"
  | "time_limit_seconds"
  | "points_per_attempt"
  | "base_points"
  | "top1_bonus"
  | "top2_5_bonus"
  | "top6_10_bonus";

const NUMBER_FIELDS: { key: NumberField; label: string; min: number; max: number }[] = [
  { key: "questions_per_attempt", label: "Số câu mỗi lượt", min: 1, max: 20 },
  { key: "max_attempts", label: "Số lượt chơi tối đa", min: 1, max: 20 },
  { key: "time_limit_seconds", label: "Thời gian mỗi lượt (giây)", min: 10, max: 1800 },
  { key: "points_per_attempt", label: "Điểm mỗi lượt thi", min: 0, max: 100 },
  { key: "base_points", label: "Điểm khi đúng hết", min: 0, max: 100 },
  { key: "top1_bonus", label: "Thưởng thêm Hạng 1", min: 0, max: 100 },
  { key: "top2_5_bonus", label: "Thưởng thêm Hạng 2–5", min: 0, max: 100 },
  { key: "top6_10_bonus", label: "Thưởng thêm Hạng 6–10", min: 0, max: 100 },
];

export function AdminQuizControl({
  settings,
  currentSession,
  sessions,
  nextStartAt,
  questionsCount,
  serverNow,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<QuizSettings>({
    ...settings,
    result_post_title: settings.result_post_title ?? DEFAULT_RESULT_POST_TITLE,
    result_post_template: settings.result_post_template ?? DEFAULT_RESULT_POST_TEMPLATE,
  });
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function call(key: string, url: string, body: unknown) {
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(url, {
        method: url.endsWith("/settings") ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Thao tác thất bại.");
      setSuccess(json.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại.");
    } finally {
      setBusy(null);
    }
  }

  const notEnoughQuestions = questionsCount < settings.questions_per_attempt;
  const now = new Date(serverNow).getTime();

  const sessionColumns: DataTableColumn<QuizSessionRow>[] = [
    {
      key: "title",
      header: "Đợt thi",
      className: "font-semibold text-on-surface",
      render: (s) => (
        <>
          {s.title}
          <span className="ml-1 text-xs font-normal text-on-surface-variant">
            ({s.mode === "auto" ? "tự động" : "thủ công"})
          </span>
        </>
      ),
    },
    {
      key: "starts_at",
      header: "Thời gian",
      type: "date",
      className: "text-on-surface-variant",
      render: (s) => (
        <>
          {formatQuizDate(s.starts_at)} {formatQuizTime(s.starts_at)}–{formatQuizTime(s.ends_at)}
        </>
      ),
    },
    {
      key: "participants",
      header: "Tham gia / Đúng hết",
      type: "number",
      accessor: (s) => (s.finalized_at ? (s.participants_count ?? 0) : null),
      render: (s) => (s.finalized_at ? `${s.participants_count ?? 0} / ${s.winners_count ?? 0}` : "—"),
    },
    {
      key: "status",
      header: "Trạng thái",
      type: "enum",
      accessor: (s) =>
        s.finalized_at ? "Đã tổng kết" : new Date(s.ends_at).getTime() <= now ? "Chờ tổng kết" : "Đang mở",
      render: (s) => {
        const ended = new Date(s.ends_at).getTime() <= now;
        return s.finalized_at ? (
          <span className="rounded-full bg-[#D9F2EC] px-2 py-0.5 text-xs font-bold text-[#173A67]">
            Đã tổng kết
          </span>
        ) : ended ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
            Chờ tổng kết
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
            Đang mở
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Thao tác",
      filterable: false,
      render: (s) => {
        const ended = new Date(s.ends_at).getTime() <= now;
        return (
          <div className="flex flex-wrap items-center gap-2">
            {s.finalized_at ? (
              <>
                {s.result_post_id ? (
                  <Link
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-0.5"
                    href={`/posts/${s.result_post_id}`}
                  >
                    <span>Xem bài kết quả</span>
                    <MaterialIcon className="text-[14px]" name="open_in_new" />
                  </Link>
                ) : null}
                <button
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                  disabled={busy !== null}
                  type="button"
                  title="Hủy kết quả, xóa bài viết và thu hồi toàn bộ điểm đã cộng"
                  onClick={() => {
                    if (
                      window.confirm(
                        `HỦY KẾT QUẢ đợt thi "${s.title}"?\n- Hệ thống sẽ thu hồi toàn bộ điểm thưởng đã cộng cho các đoàn viên.\n- Xóa bài viết kết quả.\n- Đưa đợt thi về trạng thái chờ tổng kết.`,
                      )
                    ) {
                      void call(`cancel-${s.id}`, "/api/quiz/session", {
                        action: "cancel_finalize",
                        sessionId: s.id,
                      });
                    }
                  }}
                >
                  {busy === `cancel-${s.id}` ? "Đang hủy..." : "Hủy kết quả & thu hồi điểm"}
                </button>
              </>
            ) : ended ? (
              <button
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
                disabled={busy !== null}
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `Tổng kết "${s.title}": cộng điểm cho người đúng hết và đăng bài kết quả?`,
                    )
                  )
                    void call(`finalize-${s.id}`, "/api/quiz/finalize", { sessionId: s.id });
                }}
              >
                {busy === `finalize-${s.id}` ? "Đang tổng kết..." : "Tổng kết & cộng điểm"}
              </button>
            ) : null}

            <button
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/70 px-2 py-1 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              disabled={busy !== null}
              type="button"
              title="Xóa toàn bộ đợt thi này, các lượt thi và thu hồi điểm (nếu có)"
              onClick={() => {
                if (
                  window.confirm(
                    `XÁC NHẬN XÓA đợt thi "${s.title}"?\nToàn bộ lượt làm bài và điểm đã cộng (nếu có) sẽ bị xóa vĩnh viễn khỏi hệ thống!`,
                  )
                ) {
                  void call(`delete-${s.id}`, "/api/quiz/session", {
                    action: "delete",
                    sessionId: s.id,
                  });
                }
              }}
            >
              <MaterialIcon className="text-[14px]" name="delete" />
              <span>{busy === `delete-${s.id}` ? "Đang xóa..." : "Xóa đợt"}</span>
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-title-md font-bold text-[#173A67]">
              <MaterialIcon className="text-[22px]" name="event" />
              Điều khiển sự kiện
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {settings.schedule_mode === "auto"
                ? `Tự động mở ${WEEKDAY_LABELS[settings.schedule_weekday]} hàng tuần, ${settings.start_time}–${settings.end_time} (giờ Việt Nam).`
                : "Chế độ thủ công: Admin bấm bật / tắt mỗi đợt thi."}
            </p>
            {!currentSession && nextStartAt ? (
              <p className="text-sm text-on-surface-variant">
                Lần mở tự động tiếp theo: <strong>{formatQuizDateTime(nextStartAt)}</strong>
              </p>
            ) : null}
          </div>
          {currentSession ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Đang mở đến {formatQuizTime(currentSession.ends_at)}
            </span>
          ) : (
            <span className="rounded-full bg-surface-container-high px-3 py-1 text-sm font-bold text-on-surface-variant">
              Đang tắt
            </span>
          )}
        </div>

        {notEnoughQuestions ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            Ngân hàng mới có {questionsCount} câu, cần ít nhất {settings.questions_per_attempt} câu để người chơi
            làm bài.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          {currentSession ? (
            <button
              className="rounded-xl border-2 border-error px-5 py-2 font-bold text-error disabled:opacity-60"
              disabled={busy !== null}
              type="button"
              onClick={() => {
                if (window.confirm("Tắt đợt thi ngay bây giờ? Người đang làm dở vẫn được nộp trong thời gian của lượt."))
                  void call("close", "/api/quiz/session", { action: "close" });
              }}
            >
              {busy === "close" ? "Đang tắt..." : "Tắt thi ngay"}
            </button>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-label-md" htmlFor="quizDuration">
                  Mở trong (phút)
                </label>
                <input
                  className={`${inputClass} w-28`}
                  id="quizDuration"
                  max={360}
                  min={5}
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </div>
              <button
                className="rounded-xl bg-tertiary px-5 py-2 font-bold text-on-tertiary disabled:opacity-60"
                disabled={busy !== null}
                type="button"
                onClick={() => void call("open", "/api/quiz/session", { action: "open", durationMinutes: duration })}
              >
                {busy === "open" ? "Đang bật..." : "Bật thi ngay"}
              </button>
            </>
          )}
        </div>
      </section>

      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-[#D9F2EC] px-4 py-2 text-sm text-[#173A67]">{success}</p>
      ) : null}

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <h2 className="mb-3 flex items-center gap-2 text-title-md font-bold text-[#173A67]">
          <MaterialIcon className="text-[22px]" name="history" />
          Các đợt thi gần đây
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Chưa có đợt thi nào.</p>
        ) : (
          <DataTable
            columns={sessionColumns}
            rowKey={(s) => s.id}
            rows={sessions}
          />
        )}
        <p className="mt-3 text-xs text-on-surface-variant">
          {settings.auto_finalize
            ? "Đang bật tự động tổng kết: sau khi đợt thi kết thúc (và hết giờ của lượt cuối), hệ thống tự cộng điểm và đăng bài kết quả khi có người truy cập website."
            : "Tự động tổng kết đang tắt: bấm “Tổng kết & cộng điểm” sau khi đợt thi kết thúc."}
        </p>
      </section>

      <details className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <summary className="flex cursor-pointer items-center gap-2 text-title-md font-bold text-[#173A67]">
          <MaterialIcon className="text-[22px]" name="settings" />
          Cài đặt lịch thi, điểm thưởng & bài viết kết quả
        </summary>

        <form
          className="mt-4 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void call("settings", "/api/quiz/settings", form);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-label-md" htmlFor="quizMode">
                Chế độ
              </label>
              <select
                className={inputClass}
                id="quizMode"
                value={form.schedule_mode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, schedule_mode: e.target.value as QuizSettings["schedule_mode"] }))
                }
              >
                <option value="auto">Tự động hàng tuần</option>
                <option value="manual">Thủ công (Admin bật/tắt)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-label-md" htmlFor="quizWeekday">
                Ngày trong tuần
              </label>
              <select
                className={inputClass}
                disabled={form.schedule_mode !== "auto"}
                id="quizWeekday"
                value={form.schedule_weekday}
                onChange={(e) => setForm((f) => ({ ...f, schedule_weekday: Number(e.target.value) }))}
              >
                {WEEKDAY_LABELS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-label-md" htmlFor="quizStart">
                Giờ bắt đầu
              </label>
              <input
                className={inputClass}
                disabled={form.schedule_mode !== "auto"}
                id="quizStart"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-label-md" htmlFor="quizEnd">
                Giờ kết thúc
              </label>
              <input
                className={inputClass}
                disabled={form.schedule_mode !== "auto"}
                id="quizEnd"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {NUMBER_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-label-md" htmlFor={`quiz-${field.key}`}>
                  {field.label}
                </label>
                <input
                  className={inputClass}
                  id={`quiz-${field.key}`}
                  max={field.max}
                  min={field.min}
                  type="number"
                  value={form[field.key]}
                  onChange={(e) => setForm((f) => ({ ...f, [field.key]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-on-surface-variant">
            Ví dụ mặc định: mỗi lượt thi hoàn thành được {form.points_per_attempt} điểm; đúng hết được cộng thêm {form.base_points} điểm; Hạng 1 tổng thêm {form.base_points + form.top1_bonus}{" "}
            điểm, Hạng 2–5 tổng thêm {form.base_points + form.top2_5_bonus} điểm, Hạng 6–10 tổng{" "}
            {form.base_points + form.top6_10_bonus} điểm.
          </p>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={form.auto_finalize}
                type="checkbox"
                onChange={(e) => setForm((f) => ({ ...f, auto_finalize: e.target.checked }))}
              />
              Tự động tổng kết, cộng điểm & đăng bài khi đợt thi kết thúc
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={form.result_post_publish}
                type="checkbox"
                onChange={(e) => setForm((f) => ({ ...f, result_post_publish: e.target.checked }))}
              />
              Đăng bài kết quả ở trạng thái Active (bỏ chọn để lưu nháp Inactive)
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-label-md font-bold text-[#173A67]">Bài viết soạn sẵn (tự điền thành tích)</span>
              <button
                className="text-xs font-bold text-primary hover:underline"
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    result_post_title: DEFAULT_RESULT_POST_TITLE,
                    result_post_template: DEFAULT_RESULT_POST_TEMPLATE,
                  }))
                }
              >
                Khôi phục mẫu mặc định
              </button>
            </div>
            <input
              className={inputClass}
              maxLength={200}
              placeholder="Tiêu đề bài viết"
              value={form.result_post_title ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, result_post_title: e.target.value }))}
            />
            <textarea
              className={`${inputClass} min-h-[260px] font-mono text-xs leading-relaxed`}
              value={form.result_post_template ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, result_post_template: e.target.value }))}
            />
            <div className="flex flex-wrap gap-1.5 text-xs">
              {QUIZ_TEMPLATE_PLACEHOLDERS.map((p) => (
                <span
                  key={p.key}
                  className="rounded-lg bg-surface-container px-2 py-1 text-on-surface-variant"
                  title={p.label}
                >
                  <code className="font-bold text-[#173A67]">{p.key}</code> {p.label}
                </span>
              ))}
            </div>
          </div>

          <button
            className="rounded-xl bg-[#173A67] px-6 py-2 font-bold text-white disabled:opacity-60"
            disabled={busy !== null}
            type="submit"
          >
            {busy === "settings" ? "Đang lưu..." : "Lưu cài đặt"}
          </button>
        </form>
      </details>
    </div>
  );
}
