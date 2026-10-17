"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  formatQuizDateTime,
  formatQuizDuration,
  formatQuizTime,
  type QuizStatus,
} from "@/lib/quiz-shared";

type PlayData = {
  attemptId: string;
  attemptNo: number;
  maxAttempts: number;
  startedAt: string;
  deadlineAt: string;
  offsetMs: number;
  questions: { id: string; content: string; options: string[] }[];
};

type SubmitResult = {
  late: boolean;
  correctCount: number;
  total: number;
  durationMs: number;
  perfect: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  currentRank: number | null;
  bestDurationMs: number | null;
};

type Props = {
  initialStatus: QuizStatus;
  isLoggedIn: boolean;
  isApproved: boolean;
  pointRules: string;
};

const OPTION_LABELS = ["1", "2", "3", "4"];

export function QuizPlayClient({ initialStatus, isLoggedIn, isApproved, pointRules }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [play, setPlay] = useState<PlayData | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const autoSubmittedRef = useRef<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (!play) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [play]);

  useEffect(() => {
    if (!play) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [play]);

  const submit = useCallback(
    async (data: PlayData, chosen: (number | null)[]) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/quiz/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: data.attemptId, answers: chosen }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Không thể nộp bài.");
        setResult(json as SubmitResult);
        setPlay(null);
        setStatus((s) => ({ ...s, attemptsUsed: json.attemptsUsed, hasInProgress: false }));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể nộp bài.");
      } finally {
        submittingRef.current = false;
        setBusy(false);
      }
    },
    [router],
  );

  const serverNow = play ? now + play.offsetMs : now;
  const remainingMs = play ? new Date(play.deadlineAt).getTime() - serverNow : 0;
  const elapsedMs = play ? Math.max(0, serverNow - new Date(play.startedAt).getTime()) : 0;

  useEffect(() => {
    if (play && remainingMs <= 0 && autoSubmittedRef.current !== play.attemptId) {
      autoSubmittedRef.current = play.attemptId;
      void submit(play, answers);
    }
  }, [play, remainingMs, answers, submit]);

  async function start() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/quiz/start", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể bắt đầu lượt thi.");
      setPlay({
        attemptId: json.attemptId,
        attemptNo: json.attemptNo,
        maxAttempts: json.maxAttempts,
        startedAt: json.startedAt,
        deadlineAt: json.deadlineAt,
        offsetMs: new Date(json.serverNow).getTime() - Date.now(),
        questions: json.questions,
      });
      setAnswers(Array(json.questions.length).fill(null));
      setCurrent(0);
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể bắt đầu lượt thi.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!isLoggedIn || !isApproved) {
    return (
      <div className="rounded-2xl border border-dusty-border/80 bg-white p-6 text-center shadow-xs">
        <MaterialIcon className="text-[40px] text-primary" name="lock" />
        <p className="mt-2 text-body-md font-semibold text-on-surface">
          {isLoggedIn
            ? "Tài khoản của bạn cần được phê duyệt để tham gia thi trắc nghiệm."
            : "Vui lòng đăng nhập để tham gia thi trắc nghiệm hàng tuần."}
        </p>
        {!isLoggedIn ? (
          <Link
            className="mt-4 inline-flex rounded-xl bg-primary px-5 py-2 font-bold text-white"
            href="/login?next=/quiz"
          >
            Đăng nhập
          </Link>
        ) : null}
      </div>
    );
  }

  if (play) {
    const q = play.questions[current];
    const answeredCount = answers.filter((a) => a !== null).length;
    const isLast = current === play.questions.length - 1;
    const lowTime = remainingMs <= 15_000;

    return (
      <div className="rounded-2xl border border-dusty-border/80 bg-white p-4 shadow-xs sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-dusty-light px-3 py-1 text-xs font-bold text-primary">
            Lượt {play.attemptNo}/{play.maxAttempts} · Câu {current + 1}/{play.questions.length}
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-[#173A67]">
              <MaterialIcon className="text-[16px]" name="timer" />
              {formatQuizDuration(elapsedMs)}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                lowTime ? "animate-pulse bg-red-100 text-red-700" : "bg-amber-50 text-amber-800"
              }`}
            >
              <MaterialIcon className="text-[16px]" name="hourglass_bottom" />
              Còn {Math.max(0, Math.ceil(remainingMs / 1000))} giây
            </span>
          </div>
        </div>

        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((current + 1) / play.questions.length) * 100}%` }}
          />
        </div>

        <h2 className="mb-4 whitespace-pre-wrap text-title-md font-bold text-on-surface sm:text-title-lg">
          {q.content}
        </h2>

        <div className="grid gap-2.5">
          {q.options.map((opt, i) => {
            const selected = answers[current] === i + 1;
            return (
              <button
                key={i}
                className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                  selected
                    ? "border-primary bg-primary/[0.08]"
                    : "border-dusty-border/80 hover:border-primary/60 hover:bg-surface-container-low"
                }`}
                disabled={busy}
                type="button"
                onClick={() =>
                  setAnswers((prev) => prev.map((a, idx) => (idx === current ? i + 1 : a)))
                }
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    selected ? "bg-primary text-white" : "bg-surface-container text-[#173A67]"
                  }`}
                >
                  {OPTION_LABELS[i]}
                </span>
                <span className="pt-0.5 text-body-md text-on-surface">{opt}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {play.questions.map((item, i) => (
            <button
              key={item.id}
              aria-label={`Câu ${i + 1}`}
              className={`h-8 w-8 rounded-full text-xs font-bold ${
                i === current
                  ? "bg-[#173A67] text-white"
                  : answers[i] !== null
                    ? "bg-primary/20 text-primary"
                    : "bg-surface-container text-on-surface-variant"
              }`}
              type="button"
              onClick={() => setCurrent(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            className="rounded-xl border border-dusty-border px-4 py-2 text-sm font-bold text-on-surface-variant disabled:opacity-40"
            disabled={current === 0 || busy}
            type="button"
            onClick={() => setCurrent((c) => c - 1)}
          >
            ← Câu trước
          </button>
          {isLast ? (
            <button
              className="rounded-xl bg-tertiary px-5 py-2 font-bold text-on-tertiary shadow-xs disabled:opacity-60"
              disabled={busy}
              type="button"
              onClick={() => {
                if (
                  answeredCount < play.questions.length &&
                  !window.confirm(
                    `Bạn mới trả lời ${answeredCount}/${play.questions.length} câu. Nộp bài luôn?`,
                  )
                ) {
                  return;
                }
                void submit(play, answers);
              }}
            >
              {busy ? "Đang nộp..." : "Nộp bài"}
            </button>
          ) : (
            <button
              className="rounded-xl bg-primary px-5 py-2 font-bold text-white disabled:opacity-60"
              disabled={busy}
              type="button"
              onClick={() => setCurrent((c) => c + 1)}
            >
              Câu tiếp →
            </button>
          )}
        </div>
      </div>
    );
  }

  const attemptsLeft = Math.max(0, status.maxAttempts - status.attemptsUsed);
  const canPlay = status.isOpen && (attemptsLeft > 0 || status.hasInProgress);

  return (
    <div className="space-y-4">
      {result ? (
        <div
          className={`rounded-2xl border-2 p-5 text-center shadow-xs ${
            result.perfect ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
          }`}
        >
          <MaterialIcon
            className={`text-[44px] ${result.perfect ? "text-emerald-600" : "text-amber-600"}`}
            name={result.perfect ? "celebration" : result.late ? "timer_off" : "sentiment_neutral"}
          />
          <p className="mt-1 text-title-lg font-extrabold text-on-surface">
            {result.late
              ? "Bài nộp quá hạn"
              : `Đúng ${result.correctCount}/${result.total} câu`}
          </p>
          <p className="text-sm text-on-surface-variant">
            Thời gian làm bài: <strong>{formatQuizDuration(result.durationMs)}</strong>
          </p>
          {result.perfect ? (
            <p className="mt-2 text-sm font-semibold text-emerald-800">
              Xuất sắc! Bạn đã vào bảng xếp hạng
              {result.currentRank ? ` — hạng hiện tại: ${result.currentRank}` : ""}
              {result.bestDurationMs !== null
                ? ` (thời gian tốt nhất ${formatQuizDuration(result.bestDurationMs)})`
                : ""}
              .
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-900">
              Cần đúng cả {result.total} câu để vào bảng xếp hạng. Hệ thống chỉ lấy kết quả tốt nhất của
              bạn.
            </p>
          )}
        </div>
      ) : null}

      <div className="rounded-2xl border border-dusty-border/80 bg-white p-5 shadow-xs sm:p-6">
        {status.isOpen && status.session ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Đang mở đến {formatQuizTime(status.session.endsAt)}
              </span>
              <span className="rounded-full bg-dusty-light px-2.5 py-0.5 text-xs font-bold text-primary">
                Đã dùng {status.attemptsUsed}/{status.maxAttempts} lượt
              </span>
            </div>
            <h2 className="text-title-lg font-extrabold text-[#173A67]">{status.session.title}</h2>
            {status.best ? (
              <p className="mt-1 text-sm text-on-surface-variant">
                Kết quả tốt nhất của bạn: đúng {status.best.correctCount}/{status.best.total} câu trong{" "}
                {formatQuizDuration(status.best.durationMs)}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="text-title-lg font-extrabold text-[#173A67]">Sự kiện hiện chưa mở</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {status.nextStartAt
                ? `Lần thi tiếp theo: ${formatQuizDateTime(status.nextStartAt)}.`
                : "Ban tổ chức sẽ mở thi và thông báo trên website."}
            </p>
          </>
        )}

        <ul className="mt-4 space-y-1.5 text-sm text-on-surface">
          <li className="flex gap-2">
            <MaterialIcon className="text-[18px] text-primary" name="quiz" />
            Mỗi lượt gồm {status.questionsPerAttempt} câu hỏi ngẫu nhiên, thời gian tối đa{" "}
            {status.timeLimitSeconds} giây.
          </li>
          <li className="flex gap-2">
            <MaterialIcon className="text-[18px] text-primary" name="replay" />
            Mỗi đợt được chơi tối đa {status.maxAttempts} lượt, chỉ lấy kết quả cao nhất.
          </li>
          <li className="flex gap-2">
            <MaterialIcon className="text-[18px] text-primary" name="emoji_events" />
            Đúng cả {status.questionsPerAttempt} câu mới vào bảng xếp hạng; xếp theo thời gian, bằng nhau thì
            ai làm trước xếp trên.
          </li>
          <li className="flex gap-2">
            <MaterialIcon className="text-[18px] text-primary" name="military_tech" />
            <span>Điểm sự kiện: {pointRules}</span>
          </li>
        </ul>

        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

        {status.isOpen ? (
          <button
            className="mt-5 w-full rounded-xl bg-primary px-5 py-3 text-body-md font-extrabold text-white shadow-sm transition hover:shadow-md disabled:opacity-50 sm:w-auto"
            disabled={!canPlay || busy}
            type="button"
            onClick={() => void start()}
          >
            {busy
              ? "Đang tải câu hỏi..."
              : status.hasInProgress
                ? "Tiếp tục lượt đang làm"
                : attemptsLeft > 0
                  ? `Bắt đầu lượt ${status.attemptsUsed + 1}/${status.maxAttempts}`
                  : "Bạn đã dùng hết lượt chơi"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
