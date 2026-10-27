"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollDetail, PollOption } from "@/lib/data/polls";
import { useAuth } from "@/components/auth/AuthProvider";
import { PollEntryBrowser } from "@/components/polls/PollEntryBrowser";
import { usePollPhase } from "@/components/polls/usePollPhase";
import { formatPollTime } from "@/lib/polls/phase";

type Props = {
  poll: PollDetail;
  initialNow: number;
};

const MISSING_EMPLOYEE_CODE_MESSAGE =
  "Vui lòng nhập đầy đủ thông tin. Bạn cần nhập mã nhân viên trước khi bình chọn.";

function getOrCreateDeviceFingerprint(): string {
  if (typeof window === "undefined") return "browser";
  const key = "cdilv_device_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = `fp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(key, fp);
  }
  return fp;
}

export function PollVotingSection({ poll, initialNow }: Props) {
  const router = useRouter();
  const phase = usePollPhase(poll, initialNow);
  const isPractice = phase === "upcoming";
  const { user, profile, isGuest } = useAuth();

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [predictedCount, setPredictedCount] = useState<string>("");
  const [employeeCode, setEmployeeCode] = useState<string>("");
  const [judgeToken, setJudgeToken] = useState("");
  const [judgeLinkStatus, setJudgeLinkStatus] = useState<"unknown" | "ok" | "bad">("unknown");

  const isCurrentUserJudge = useMemo(() => {
    if (!poll.hasJudges || !poll.judgeList || poll.judgeList.length === 0) return false;
    const currentCode = (profile?.employee_code || "").trim().toUpperCase();
    if (!currentCode) return false;
    return poll.judgeList.some((j) => j.employeeCode.toUpperCase() === currentCode);
  }, [poll.hasJudges, poll.judgeList, profile?.employee_code]);

  useEffect(() => {
    if (!poll.hasJudges) return;
    const token = new URLSearchParams(window.location.search).get("gk")?.trim() ?? "";
    if (!token) return;

    setJudgeToken(token);
    let cancelled = false;
    fetch(
      `/api/polls/judge-link/verify?pollId=${encodeURIComponent(poll.id)}&token=${encodeURIComponent(token)}`,
    )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setJudgeLinkStatus(res.ok && data.ok ? "ok" : "bad");
      })
      .catch(() => {
        if (!cancelled) setJudgeLinkStatus("bad");
      });

    return () => {
      cancelled = true;
    };
  }, [poll.hasJudges, poll.id]);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successIsPractice, setSuccessIsPractice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previousPhase = useRef(phase);
  useEffect(() => {
    if (previousPhase.current === phase) return;
    const wasPractice = previousPhase.current === "upcoming";
    previousPhase.current = phase;
    setSelectedOptionIds([]);
    setErrorMessage(null);
    if (wasPractice && phase === "open") {
      setSuccessIsPractice(false);
      setSuccessMessage("Chương trình đã chính thức mở! Từ bây giờ phiếu bình chọn của bạn sẽ được ghi nhận.");
    } else {
      setSuccessMessage(null);
    }
    router.refresh();
  }, [phase, router]);

  useEffect(() => {
    if (!errorMessage || errorMessage === MISSING_EMPLOYEE_CODE_MESSAGE) return;
    document.getElementById("poll-vote-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [errorMessage]);

  function showResult() {
    window.setTimeout(() => {
      document.getElementById("poll-vote-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  const selectedOptions = useMemo(
    () => poll.options.filter((opt) => selectedOptionIds.includes(opt.id)),
    [poll.options, selectedOptionIds],
  );

  const maxVotes = poll.maxVotesPerUser || 3;
  const isClosed = phase === "closed" || phase === "ended";
  const isInactive = poll.isActive === false;

  // Free poll safety limit: max 250 guest votes
  const maxGuestVotes = poll.maxGuestVotes ?? 250;
  const currentGuestVotes = poll.guestVoteCount ?? 0;
  const judgeLinkPending = Boolean(judgeToken) && judgeLinkStatus === "unknown";
  const judgeLinkOk = judgeLinkStatus === "ok";
  const isGuestLimitReached =
    poll.accessType === "free" && currentGuestVotes >= maxGuestVotes;
  const isBlockedForGuest = isGuest && isGuestLimitReached && !judgeLinkOk && !judgeLinkPending;
  const needsEmployeeCode = isGuest && (poll.accessType === "free" || judgeLinkOk || judgeLinkPending);

  function handleToggleOption(optionId: string) {
    if (isClosed || isInactive) return;

    if (isBlockedForGuest) {
      alert(
        "Chương trình hiện chỉ mở bình chọn cho Đoàn viên Công đoàn. Vui lòng đăng nhập tài khoản để bình chọn."
      );
      return;
    }

    if (selectedOptionIds.includes(optionId)) {
      setSelectedOptionIds(selectedOptionIds.filter((id) => id !== optionId));
      return;
    }

    if (selectedOptionIds.length >= maxVotes) {
      alert(`Bạn chỉ được chọn tối đa ${maxVotes} bài thi.`);
      return;
    }

    setSelectedOptionIds([...selectedOptionIds, optionId]);
  }

  async function handleSubmitVote(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isInactive) {
      setErrorMessage("Chương trình đang tạm ngưng (Inactive), không nhận thêm bình chọn.");
      return;
    }

    if (isBlockedForGuest) {
      setErrorMessage(
        "Chương trình hiện chỉ mở bình chọn cho Đoàn viên Công đoàn. Vui lòng đăng nhập tài khoản để gửi bình chọn."
      );
      return;
    }

    if (selectedOptionIds.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất 1 bài thi để bình chọn.");
      return;
    }

    if (poll.accessType === "members_only" && isGuest && !judgeLinkOk && !judgeLinkPending) {
      setErrorMessage("Chương trình này yêu cầu đăng nhập tài khoản đoàn viên để bình chọn.");
      return;
    }

    if (needsEmployeeCode && !employeeCode.trim()) {
      setErrorMessage(MISSING_EMPLOYEE_CODE_MESSAGE);
      const input = document.getElementById("voter-employee-code");
      input?.focus();
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      alert(MISSING_EMPLOYEE_CODE_MESSAGE);
      return;
    }

    if (poll.hasPrediction) {
      if (!predictedCount || isNaN(parseInt(predictedCount, 10))) {
        setErrorMessage("Vui lòng nhập số người dự đoán cho bài thi đạt giải nhất.");
        return;
      }
    }

    if (isPractice) {
      setSuccessIsPractice(true);
      setSuccessMessage(
        `Bạn đã thao tác đúng! Đây là phiếu THỬ nên không được ghi nhận. ${
          poll.opensAt
            ? `Khi chương trình mở lúc ${formatPollTime(poll.opensAt)}, hãy làm lại các bước như vậy để gửi phiếu thật.`
            : "Khi chương trình mở, hãy làm lại các bước như vậy để gửi phiếu thật."
        }`,
      );
      setSelectedOptionIds([]);
      setPredictedCount("");
      showResult();
      return;
    }

    setSubmitting(true);
    const fingerprint = getOrCreateDeviceFingerprint();

    try {
      const res = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId: poll.id,
          optionIds: selectedOptionIds,
          deviceFingerprint: fingerprint,
          predictedCount: poll.hasPrediction ? parseInt(predictedCount, 10) : undefined,
          employeeCode: needsEmployeeCode ? employeeCode.trim() : undefined,
          judgeToken: judgeLinkOk || judgeLinkPending ? judgeToken : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gửi bình chọn thất bại.");
      }

      setSuccessIsPractice(false);
      setSuccessMessage(data.message || "Bình chọn thành công! Cảm ơn bạn.");
      showResult();
      setSelectedOptionIds([]);
      setPredictedCount("");
      setEmployeeCode("");
    } catch (err: any) {
      setErrorMessage(err?.message || "Đã xảy ra lỗi khi gửi bình chọn.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderVoteAction(opt: PollOption) {
    if (isInactive) {
      return (
        <div className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-500 border border-slate-200">
          <MaterialIcon className="text-[16px]" name="pause_circle" />
          <span>Tạm ngưng bình chọn</span>
        </div>
      );
    }
    if (isClosed) {
      return (
        <div className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-600 border border-slate-200">
          <MaterialIcon className="text-[16px]" name="lock" />
          <span>Chương trình đã kết thúc, chỉ xem bài thi</span>
        </div>
      );
    }
    if (isBlockedForGuest) {
      return (
        <Link
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary/10 py-2.5 text-xs font-bold text-primary hover:bg-primary/20 transition shadow-2xs border border-primary/20"
          href={`/login?returnUrl=/polls/${poll.id}`}
        >
          <MaterialIcon className="text-[16px]" name="login" />
          <span>Đăng nhập để bình chọn</span>
        </Link>
      );
    }
    const isSelected = selectedOptionIds.includes(opt.id);
    return (
      <button
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold transition shadow-xs cursor-pointer ${
          isSelected ? "bg-primary text-white" : "border-2 border-primary text-primary hover:bg-primary/10"
        }`}
        type="button"
        onClick={() => handleToggleOption(opt.id)}
      >
        <MaterialIcon name={isSelected ? "check_circle" : "radio_button_unchecked"} />
        <span>{isSelected ? "Đã chọn bài thi này (bấm để bỏ)" : "Bình chọn bài thi này"}</span>
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {judgeLinkOk ? (
        <div className="rounded-2xl border border-[#173A67]/20 bg-[#173A67]/5 p-4 text-[#173A67]">
          <p className="text-sm font-extrabold">Link riêng của Ban giám khảo</p>
          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-on-surface-variant">
            Nhập đúng mã nhân viên trong danh sách giám khảo. Link công khai không nhận phiếu của giám khảo chưa có tài khoản.
          </p>
        </div>
      ) : null}

      {judgeLinkStatus === "bad" ? (
        <div className="rounded-2xl border border-error/30 bg-error-container/40 p-4 text-on-error-container">
          <p className="text-sm font-bold">Link giám khảo không hợp lệ. Hãy dùng đúng đường dẫn do ban tổ chức gửi.</p>
        </div>
      ) : null}

      {/* Title & Instructions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h3 className="text-headline-sm font-extrabold text-[#173A67]">
            Danh Sách Bài Thi Bình Chọn
          </h3>
          <p className="text-body-sm text-on-surface-variant">
            {isInactive
              ? "Chương trình hiện đang tạm ngưng (Inactive)."
              : isClosed
              ? "Chương trình bình chọn đã kết thúc."
              : isBlockedForGuest
              ? "Chương trình hiện mở bình chọn cho Đoàn viên Công đoàn đã đăng nhập."
              : isPractice
              ? `Bình chọn thử: chọn tối đa ${maxVotes} bài thi để làm quen (Đã chọn: ${selectedOptionIds.length}/${maxVotes})`
              : `Chọn tối đa ${maxVotes} bài thi bạn yêu thích nhất (Đã chọn: ${selectedOptionIds.length}/${maxVotes})`}
          </p>
        </div>

        {!isClosed && !isInactive ? (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3.5 py-1.5 text-label-md font-bold text-amber-900 border border-amber-300">
            <MaterialIcon className="text-[18px] text-amber-600" name="how_to_vote" />
            <span>Được chọn tối đa {maxVotes} bài thi</span>
          </div>
        ) : null}
      </div>

      {/* Login required banner for Non-Members when guest limit reached */}
      {isBlockedForGuest && !isClosed && !isInactive ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-[#173A67] shadow-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
              <MaterialIcon className="text-[22px]" name="how_to_reg" />
            </span>
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-[#173A67]">
                Chương trình hiện yêu cầu đăng nhập tài khoản Đoàn viên
              </h4>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 leading-relaxed">
                Quý đoàn viên vui lòng đăng nhập tài khoản để tiếp tục bình chọn cho bài thi yêu thích và tích lũy điểm thi đua.
              </p>
            </div>
          </div>
          <Link
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-dusty-dark transition"
            href={`/login?returnUrl=/polls/${poll.id}`}
          >
            <MaterialIcon className="text-[16px]" name="login" />
            <span>Đăng nhập Đoàn viên</span>
          </Link>
        </div>
      ) : null}

      {isPractice && !isInactive ? (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50 p-4 text-sky-950">
          <MaterialIcon className="text-[26px] text-sky-600 shrink-0" name="school" />
          <div>
            <p className="text-sm sm:text-base font-extrabold">Chế độ bình chọn thử</p>
            <p className="text-xs sm:text-sm leading-relaxed mt-0.5">
              Chương trình chưa mở nên phiếu gửi lúc này <strong>không được ghi nhận</strong>. Hãy thử chọn bài thi và gửi phiếu để quen thao tác
              {poll.opensAt ? `, khi mở thật lúc ${formatPollTime(poll.opensAt)} bạn sẽ làm nhanh hơn.` : ", khi mở thật bạn sẽ làm nhanh hơn."}
            </p>
          </div>
        </div>
      ) : null}

      {/* Success banner */}
      {successMessage ? (
        <div
          id="poll-vote-result"
          className={`flex items-center gap-3 rounded-2xl border p-5 shadow-xs ${
            successIsPractice
              ? "border-sky-300 bg-sky-50 text-sky-950"
              : "border-emerald-300 bg-emerald-50 text-emerald-900"
          }`}
        >
          <MaterialIcon
            className={`text-[28px] shrink-0 ${successIsPractice ? "text-sky-600" : "text-emerald-600"}`}
            name={successIsPractice ? "task_alt" : "check_circle"}
          />
          <div>
            <p className="text-title-sm font-bold">
              {successIsPractice ? "Bình chọn thử thành công!" : "Thành công!"}
            </p>
            <p className="text-body-md">{successMessage}</p>
          </div>
        </div>
      ) : null}

      {/* Error banner */}
      {errorMessage ? (
        <div
          id="poll-vote-error"
          className="flex items-center gap-3 rounded-2xl border border-error/40 bg-error-container/40 p-4 text-on-error-container shadow-xs"
        >
          <MaterialIcon className="text-[24px] text-error shrink-0" name="error" />
          <p className="text-body-md font-medium">{errorMessage}</p>
        </div>
      ) : null}

      {/* Judge scoring rules & voter role indicator */}
      {poll.hasJudges && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#173A67] text-white">
                <MaterialIcon className="text-[20px]" name="gavel" />
              </span>
              <div>
                <h4 className="text-sm sm:text-base font-extrabold text-[#173A67]">
                  Cuộc thi áp dụng chấm điểm Ban Giám Khảo ({poll.judgeWeightPercent ?? 30}%) & Đoàn viên ({100 - (poll.judgeWeightPercent ?? 30)}%)
                </h4>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Điểm tổng kết thang 10 tính theo tỉ lệ số người thực tế tham gia bình chọn của từng nhóm.
                </p>
              </div>
            </div>

            {isCurrentUserJudge ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 text-white px-3 py-1 text-xs font-black shadow-xs">
                <MaterialIcon className="text-[16px]" name="verified" />
                <span>Bạn là Giám khảo ({profile?.employee_code})</span>
              </span>
            ) : user ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 text-slate-800 px-3 py-1 text-xs font-bold">
                <MaterialIcon className="text-[16px]" name="person" />
                <span>Bình chọn đoàn viên</span>
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Từng bài thi một: danh sách chữ + chi tiết */}
      <PollEntryBrowser
        options={poll.options}
        pollId={poll.id}
        renderActions={renderVoteAction}
        showImages={poll.contentType === "image"}
        statusFor={(id) => (selectedOptionIds.includes(id) ? { label: "Đã chọn", tone: "selected" } : null)}
      />

      {!isClosed && !isInactive && !isBlockedForGuest ? (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-amber-400 bg-amber-50/95 px-3 py-2.5 shadow-md backdrop-blur-xs">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-amber-950">
              Đã chọn {selectedOptionIds.length}/{maxVotes} bài thi
            </p>
            {selectedOptions.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {selectedOptions.map((opt) => (
                  <button
                    key={opt.id}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#173A67] border border-amber-300 cursor-pointer hover:bg-rose-50"
                    title="Bỏ chọn"
                    type="button"
                    onClick={() => handleToggleOption(opt.id)}
                  >
                    #{opt.orderNum} {opt.title}
                    <MaterialIcon className="text-[13px] text-rose-600" name="close" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-amber-900">Mở từng bài thi và bấm “Bình chọn bài thi này”.</p>
            )}
          </div>
          <button
            className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-dusty-dark transition cursor-pointer disabled:opacity-50"
            disabled={selectedOptionIds.length === 0}
            type="button"
            onClick={() =>
              document.getElementById("poll-vote-form")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            Gửi phiếu
          </button>
        </div>
      ) : null}

      {/* Submission Form (Prediction & Final Action) */}
      {isInactive ? (
        <div className="mt-6 sm:mt-8 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-6 text-center text-amber-950">
          <MaterialIcon className="text-[36px] text-amber-600 mx-auto mb-2" name="visibility_off" />
          <h3 className="text-base sm:text-title-md font-bold">Chương trình bình chọn đang ở trạng thái Inactive (Tạm ẩn)</h3>
          <p className="text-xs sm:text-body-sm text-amber-800 mt-1 max-w-lg mx-auto">
            Hệ thống tạm ngưng nhận bình chọn. Bạn sẽ có thể gửi bình chọn khi Quản trị viên kích hoạt lại chương trình.
          </p>
        </div>
      ) : isBlockedForGuest ? (
        <div className="mt-6 sm:mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 text-center text-[#173A67] space-y-3">
          <MaterialIcon className="text-[38px] text-primary mx-auto" name="how_to_reg" />
          <h3 className="text-base sm:text-title-lg font-extrabold text-[#173A67]">
            Vui lòng đăng nhập tài khoản Đoàn viên
          </h3>
          <p className="text-xs sm:text-body-sm text-on-surface-variant max-w-lg mx-auto leading-relaxed">
            Chương trình hiện dành quyền bình chọn cho Đoàn viên Công đoàn. Quý đoàn viên vui lòng đăng nhập để gửi phiếu bình chọn.
          </p>
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-dusty-dark transition"
            href={`/login?returnUrl=/polls/${poll.id}`}
          >
            <MaterialIcon className="text-[18px]" name="login" />
            <span>Đăng nhập tài khoản Đoàn viên</span>
          </Link>
        </div>
      ) : !isClosed ? (
        <form
          className="mt-6 sm:mt-8 space-y-4 sm:space-y-6 rounded-2xl border-2 border-amber-400 bg-amber-50/40 p-4 sm:p-8 shadow-xs scroll-mt-20"
          id="poll-vote-form"
          onSubmit={handleSubmitVote}
        >
          <div className="flex items-center gap-2 text-amber-950">
            <MaterialIcon className="text-[22px] sm:text-[26px] text-amber-600 shrink-0" name="how_to_vote" />
            <h3 className="text-base sm:text-title-lg font-black">Xác Nhận & Gửi Phiếu Bình Chọn</h3>
            {isPractice ? (
              <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">
                Thử
              </span>
            ) : null}
          </div>

          <p className="text-sm sm:text-body-md text-amber-900">
            Bạn đang chọn <strong>{selectedOptionIds.length}</strong> / {maxVotes} bài thi.
          </p>
          {selectedOptions.length > 0 ? (
            <ul className="space-y-1 text-sm font-semibold text-[#173A67]">
              {selectedOptions.map((opt) => (
                <li key={opt.id} className="flex items-center gap-2">
                  <MaterialIcon className="text-[16px] text-primary" name="check_circle" />
                  <span>
                    #{opt.orderNum} · {opt.title}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {poll.hasJudges && (
            <div className="rounded-xl bg-white/90 border border-amber-300/80 p-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <span className="flex items-center gap-1.5 font-medium">
                <MaterialIcon className="text-[18px] text-amber-700" name="gavel" />
                <span>
                  {isCurrentUserJudge || judgeLinkOk
                    ? "Phiếu của bạn sẽ được tính vào nhóm Ban Giám Khảo khi mã nhân viên đúng danh sách."
                    : "Phiếu của bạn sẽ được tính vào nhóm Bình chọn khác."}
                </span>
              </span>
              <span className="font-extrabold text-[#173A67] bg-amber-100 px-2 py-0.5 rounded-md">
                Trọng số: {isCurrentUserJudge || judgeLinkOk ? `${poll.judgeWeightPercent ?? 30}% (Hệ số ${((poll.judgeWeightPercent ?? 30) / 10).toFixed(1)} đ)` : `${100 - (poll.judgeWeightPercent ?? 30)}% (Hệ số ${((100 - (poll.judgeWeightPercent ?? 30)) / 10).toFixed(1)} đ)`}
              </span>
            </div>
          )}

          {needsEmployeeCode ? (
            <div className="space-y-2 rounded-xl border border-amber-300 bg-white p-3.5 sm:p-5 shadow-2xs">
              <label className="text-label-md font-bold text-[#173A67]" htmlFor="voter-employee-code">
                Mã nhân viên <span className="text-error">*</span>
              </label>
              <input
                id="voter-employee-code"
                className={`mt-1 w-full max-w-sm rounded-xl border bg-surface-container-low px-4 py-2.5 text-body-md font-semibold text-[#173A67] focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                  errorMessage === MISSING_EMPLOYEE_CODE_MESSAGE
                    ? "border-error ring-2 ring-error/30"
                    : "border-outline-variant"
                }`}
                placeholder="Nhập mã nhân viên"
                type="text"
                autoComplete="off"
                aria-invalid={errorMessage === MISSING_EMPLOYEE_CODE_MESSAGE}
                value={employeeCode}
                onChange={(e) => {
                  setEmployeeCode(e.target.value);
                  if (e.target.value.trim()) {
                    setErrorMessage((current) =>
                      current === MISSING_EMPLOYEE_CODE_MESSAGE ? null : current,
                    );
                  }
                }}
              />
              {errorMessage === MISSING_EMPLOYEE_CODE_MESSAGE ? (
                <p className="text-sm font-bold text-error" role="alert">
                  {MISSING_EMPLOYEE_CODE_MESSAGE}
                </p>
              ) : null}
              <p className="text-label-sm text-on-surface-variant leading-relaxed">
                {judgeLinkOk
                  ? "Chỉ mã trong danh sách Ban giám khảo mới gửi được phiếu qua link này. Nếu mã đã có phiếu, hệ thống lấy kết quả lần bình chọn sau."
                  : "Người chưa là đoàn viên cần nhập mã nhân viên. Không nhập thì phiếu không được tính. Mã thuộc Ban giám khảo chưa có tài khoản không dùng được trên trang này."}
              </p>
            </div>
          ) : null}

          {/* Prediction Question Section */}
          {poll.hasPrediction ? (
            <div className="space-y-3 sm:space-y-4 rounded-xl border border-amber-300 bg-white p-3.5 sm:p-5 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-500/10 p-2 text-amber-700 shrink-0">
                  <MaterialIcon className="text-[22px]" name="help" />
                </div>
                <div>
                  <h4 className="text-title-sm font-bold text-[#173A67]">
                    Câu hỏi dự đoán trúng thưởng
                  </h4>
                  <p className="text-body-md text-amber-950 font-semibold mt-0.5">
                    {poll.predictionQuestion}
                  </p>
                  <p className="text-label-xs text-on-surface-variant mt-1">
                    Người có kết quả dự đoán gần đúng nhất (hoặc sớm nhất) sẽ được thưởng +
                    {poll.predictorRewardPoints} điểm thi đua!
                  </p>
                </div>
              </div>

              <div>
                <label className="text-label-md font-bold text-[#173A67]" htmlFor="pred-num">
                  Số phiếu dự đoán cho bài thi đạt Giải Nhất:
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    id="pred-num"
                    className="w-full max-w-xs rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 text-headline-sm font-black text-[#173A67] focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="VD: 120"
                    required
                    type="number"
                    value={predictedCount}
                    onChange={(e) => setPredictedCount(e.target.value)}
                  />
                  <span className="font-bold text-[#173A67]">người</span>
                </div>
              </div>

              <p className="text-label-xs text-on-surface-variant">
                Kết quả dự đoán được ghi nhận theo mã nhân viên của bạn, không cần nhập thêm thông tin liên hệ.
              </p>
            </div>
          ) : null}

          {/* Submit Button */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <p className="text-label-sm text-on-surface-variant">
              {isPractice
                ? "Phiếu thử không được ghi nhận. Khi mở thật, mỗi thiết bị chỉ được gửi 1 lần mỗi 30 phút."
                : "Mỗi thiết bị chỉ được gửi 1 lần mỗi 30 phút để chống spam."}
            </p>

            <button
              className={`flex items-center gap-2 rounded-xl px-8 py-3.5 text-title-sm font-extrabold text-white shadow-md transition cursor-pointer disabled:opacity-50 ${
                isPractice ? "bg-sky-600 hover:bg-sky-700" : "bg-primary hover:bg-dusty-dark"
              }`}
              disabled={submitting || selectedOptionIds.length === 0}
              type="submit"
            >
              <MaterialIcon className="text-[22px]" name="send" />
              <span>
                {submitting
                  ? "Đang gửi bình chọn..."
                  : isPractice
                  ? "Gửi phiếu bình chọn thử"
                  : "Gửi phiếu bình chọn"}
              </span>
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
