"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollDetail } from "@/lib/data/polls";
import { useAuth } from "@/components/auth/AuthProvider";
import { ImageLightboxModal } from "@/components/polls/ImageLightboxModal";
import { usePollPhase } from "@/components/polls/usePollPhase";
import { formatPollTime } from "@/lib/polls/phase";
import { VOTE_MODE_LABEL } from "@/lib/polls/vote-mode";

type Props = {
  poll: PollDetail;
  initialNow: number;
};

type VoterState = {
  voterKind: "individual" | "team";
  teamTitle: string | null;
  isJudge: boolean;
  employeeCode: string | null;
  blockedOptionIds: string[];
  base: number;
  granted: number;
  budget: number;
  used: number;
  remaining: number;
  allocations: Record<string, number>;
  grants: Array<{ points: number; reason: string; createdAt: string }>;
};

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

function toPoints(raw: string): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function PollPointsVotingSection({ poll, initialNow }: Props) {
  const router = useRouter();
  const phase = usePollPhase(poll, initialNow);
  const isPractice = phase === "upcoming";
  const isClosed = phase === "closed" || phase === "ended";
  const isInactive = poll.isActive === false;
  const { user, loading: authLoading } = useAuth();

  const [judgeToken, setJudgeToken] = useState("");
  const [judgeLinkStatus, setJudgeLinkStatus] = useState<"unknown" | "ok" | "bad">("unknown");
  const [employeeCode, setEmployeeCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [voter, setVoter] = useState<VoterState | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [loadingState, setLoadingState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  const options = useMemo(() => poll.options.filter((o) => o.isActive !== false), [poll.options]);
  const judgeLinkOk = judgeLinkStatus === "ok";
  const judgeLinkPending = Boolean(judgeToken) && judgeLinkStatus === "unknown";

  useEffect(() => {
    if (!poll.hasJudges) return;
    const token = new URLSearchParams(window.location.search).get("gk")?.trim() ?? "";
    if (!token) return;
    setJudgeToken(token);
    let cancelled = false;
    fetch(`/api/polls/judge-link/verify?pollId=${encodeURIComponent(poll.id)}&token=${encodeURIComponent(token)}`)
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

  const applyState = useCallback((data: VoterState) => {
    setVoter(data);
    setDraft({ ...data.allocations });
  }, []);

  const loadState = useCallback(
    async (code?: string) => {
      setLoadingState(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams({ pollId: poll.id });
        if (code) params.set("employeeCode", code);
        if (judgeToken) params.set("gk", judgeToken);
        const res = await fetch(`/api/polls/points?${params.toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.needsEmployeeCode) {
            setNeedsCode(true);
            if (code) setErrorMessage(data.error || "Vui lòng nhập mã nhân viên.");
            return;
          }
          throw new Error(data.error || "Không tải được điểm bình chọn.");
        }
        setNeedsCode(Boolean(code));
        applyState(data as VoterState);
      } catch (err: any) {
        setErrorMessage(err?.message || "Không tải được điểm bình chọn.");
      } finally {
        setLoadingState(false);
      }
    },
    [applyState, judgeToken, poll.id],
  );

  const autoLoaded = useRef(false);
  useEffect(() => {
    if (authLoading || judgeLinkPending || autoLoaded.current) return;
    autoLoaded.current = true;
    if (user) {
      void loadState();
    } else if (poll.accessType === "free" || judgeLinkOk) {
      setNeedsCode(true);
    }
  }, [authLoading, judgeLinkOk, judgeLinkPending, loadState, poll.accessType, user]);

  const blocked = useMemo(() => new Set(voter?.blockedOptionIds ?? []), [voter?.blockedOptionIds]);
  const budget = voter?.budget ?? (poll.pointsPerVoter || 0);
  const draftTotal = Object.values(draft).reduce((sum, v) => sum + (v || 0), 0);
  const remaining = budget - draftTotal;
  const savedAllocations = voter?.allocations ?? {};
  const isDirty = useMemo(() => {
    const keys = new Set([...Object.keys(draft), ...Object.keys(savedAllocations)]);
    for (const key of keys) {
      if ((draft[key] || 0) !== (savedAllocations[key] || 0)) return true;
    }
    return false;
  }, [draft, savedAllocations]);
  const onlyReduces = useMemo(
    () => Object.entries(draft).every(([key, v]) => (v || 0) <= (savedAllocations[key] || 0)),
    [draft, savedAllocations],
  );
  const overBudget = draftTotal > budget && !onlyReduces;

  const canEdit = !isClosed && !isInactive && (isPractice || Boolean(voter));
  const membersOnlyBlocked = poll.accessType === "members_only" && !user && !judgeLinkOk && !judgeLinkPending;

  function setOptionPoints(optionId: string, value: number) {
    setSuccessMessage(null);
    setDraft((prev) => {
      const next = { ...prev };
      if (value > 0) next[optionId] = value;
      else delete next[optionId];
      return next;
    });
  }

  async function submit(allocations: Record<string, number>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isPractice) {
      setSuccessMessage(
        `Bạn đã thao tác đúng! Đây là bình chọn THỬ nên điểm không được ghi nhận. ${
          poll.opensAt
            ? `Khi chương trình mở lúc ${formatPollTime(poll.opensAt)}, hãy phân bổ điểm lại như vậy.`
            : "Khi chương trình mở, hãy phân bổ điểm lại như vậy."
        }`,
      );
      return;
    }

    const keys = new Set([...Object.keys(allocations), ...Object.keys(savedAllocations)]);
    const payload = [...keys].map((optionId) => ({ optionId, points: allocations[optionId] || 0 }));

    setSaving(true);
    try {
      const res = await fetch("/api/polls/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId: poll.id,
          allocations: payload,
          employeeCode: needsCode ? employeeCode.trim() : undefined,
          judgeToken: judgeLinkOk || judgeLinkPending ? judgeToken : undefined,
          deviceFingerprint: getOrCreateDeviceFingerprint(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không lưu được điểm bình chọn.");
      applyState(data as VoterState);
      setSuccessMessage(data.message || "Đã lưu điểm bình chọn.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Không lưu được điểm bình chọn.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <ImageLightboxModal
        imageUrl={zoomedImage?.url || null}
        title={zoomedImage?.title}
        onClose={() => setZoomedImage(null)}
      />

      {judgeLinkOk ? (
        <div className="rounded-2xl border border-[#173A67]/20 bg-[#173A67]/5 p-4 text-[#173A67]">
          <p className="text-sm font-extrabold">Link riêng của Ban giám khảo</p>
          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-on-surface-variant">
            Nhập đúng mã nhân viên trong danh sách giám khảo. Link công khai không nhận điểm của giám khảo chưa có tài khoản.
          </p>
        </div>
      ) : null}
      {judgeLinkStatus === "bad" ? (
        <div className="rounded-2xl border border-error/30 bg-error-container/40 p-4 text-on-error-container">
          <p className="text-sm font-bold">Link giám khảo không hợp lệ. Hãy dùng đúng đường dẫn do ban tổ chức gửi.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h3 className="text-headline-sm font-extrabold text-[#173A67]">Danh Sách Bài Thi Bình Chọn</h3>
          <p className="text-body-sm text-on-surface-variant">
            {isInactive
              ? "Chương trình hiện đang tạm ngưng (Inactive)."
              : isClosed
              ? "Chương trình bình chọn đã kết thúc."
              : isPractice
              ? "Bình chọn thử: chia điểm cho các bài thi để làm quen (chưa ghi nhận)."
              : "Chia điểm của bạn cho một hoặc nhiều bài thi. Có thể sửa hoặc rút điểm khi chương trình còn mở."}
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3.5 py-1.5 text-label-md font-bold text-amber-900 border border-amber-300">
          <MaterialIcon className="text-[18px] text-amber-600" name="scoreboard" />
          {VOTE_MODE_LABEL.points}
        </span>
      </div>

      {isPractice && !isInactive ? (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50 p-4 text-sky-950">
          <MaterialIcon className="text-[26px] text-sky-600 shrink-0" name="school" />
          <p className="text-xs sm:text-sm leading-relaxed">
            Chương trình chưa mở nên điểm lưu lúc này <strong>không được ghi nhận</strong>.
            {poll.opensAt ? ` Mở thật lúc ${formatPollTime(poll.opensAt)}.` : ""}
          </p>
        </div>
      ) : null}

      {membersOnlyBlocked && !isClosed ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-[#173A67] flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">Chương trình này chỉ dành cho đoàn viên đã đăng nhập.</p>
          <Link
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-dusty-dark transition"
            href={`/login?returnUrl=/polls/${poll.id}`}
          >
            <MaterialIcon className="text-[16px]" name="login" />
            <span>Đăng nhập Đoàn viên</span>
          </Link>
        </div>
      ) : null}

      {needsCode && !isClosed && !isInactive && !membersOnlyBlocked ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!employeeCode.trim()) {
              setErrorMessage("Vui lòng nhập mã nhân viên.");
              return;
            }
            void loadState(employeeCode.trim());
          }}
        >
          <label className="block flex-1 min-w-[180px] space-y-1">
            <span className="text-xs font-bold text-amber-950">Mã nhân viên của bạn</span>
            <input
              id="voter-employee-code"
              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold uppercase"
              placeholder="VD: 0139"
              type="text"
              value={employeeCode}
              onChange={(e) => {
                setEmployeeCode(e.target.value);
                setVoter(null);
                setDraft({});
              }}
            />
          </label>
          <button
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-amber-600 transition cursor-pointer disabled:opacity-50"
            disabled={loadingState}
            type="submit"
          >
            {loadingState ? "Đang tải..." : "Xem điểm của tôi"}
          </button>
        </form>
      ) : null}

      {voter ? (
        <div className="rounded-2xl border-2 border-[#173A67]/20 bg-[#173A67]/5 p-4 sm:p-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[#173A67]">
              <p className="font-extrabold">
                {voter.isJudge
                  ? `Bạn là Giám khảo${voter.employeeCode ? ` (${voter.employeeCode})` : ""}`
                  : voter.voterKind === "team"
                  ? `Điểm chung của đội: ${voter.teamTitle ?? ""}`
                  : `Điểm cá nhân${voter.employeeCode ? ` (${voter.employeeCode})` : ""}`}
              </p>
              <p className="text-xs text-on-surface-variant">
                Được phân bổ {voter.budget} điểm ({voter.base} điểm cơ bản
                {voter.granted > 0 ? ` + ${voter.granted} điểm cộng thêm` : ""}).
                {voter.voterKind === "team" ? " Mọi thành viên của đội cùng dùng số điểm này." : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 text-center">
              <div className="rounded-xl bg-white px-3 py-1.5 shadow-2xs">
                <p className="text-[11px] font-semibold text-on-surface-variant">Đã chia</p>
                <p className="text-lg font-black text-[#173A67]">{draftTotal}</p>
              </div>
              <div className={`rounded-xl px-3 py-1.5 shadow-2xs ${remaining < 0 ? "bg-rose-100" : "bg-emerald-50"}`}>
                <p className="text-[11px] font-semibold text-on-surface-variant">Còn lại</p>
                <p className={`text-lg font-black ${remaining < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {remaining}
                </p>
              </div>
            </div>
          </div>
          {voter.grants.length > 0 ? (
            <ul className="text-xs text-on-surface-variant list-disc pl-5">
              {voter.grants.map((g, i) => (
                <li key={i}>
                  +{g.points} điểm: {g.reason}
                </li>
              ))}
            </ul>
          ) : null}
          {!poll.allowSelfVote && voter.blockedOptionIds.length > 0 ? (
            <p className="text-xs font-semibold text-amber-800">
              Chương trình không cho bình chọn điểm cho đội/bài thi của chính mình.
            </p>
          ) : null}
        </div>
      ) : isPractice && !isInactive ? (
        <p className="text-xs text-on-surface-variant">
          Mỗi người bình chọn có {poll.pointsPerVoter} điểm, mỗi đội chơi có {poll.pointsPerTeam} điểm.
        </p>
      ) : null}

      {successMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
          <MaterialIcon className="text-[24px] text-emerald-600 shrink-0" name="check_circle" />
          <p className="text-body-md font-medium">{successMessage}</p>
        </div>
      ) : null}
      {errorMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-error/40 bg-error-container/40 p-4 text-on-error-container">
          <MaterialIcon className="text-[24px] text-error shrink-0" name="error" />
          <p className="text-body-md font-medium">{errorMessage}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {options.map((opt) => {
          const value = draft[opt.id] || 0;
          const isBlocked = blocked.has(opt.id);
          return (
            <div
              key={opt.id}
              className={`flex gap-3 rounded-2xl border-2 p-3 sm:p-4 transition ${
                value > 0 ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-lowest"
              }`}
            >
              {poll.contentType === "image" && opt.imageUrls.length > 0 ? (
                <button
                  className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl bg-surface-container cursor-pointer"
                  type="button"
                  onClick={() => setZoomedImage({ url: opt.imageUrls[0], title: opt.title })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={opt.title} className="h-full w-full object-cover" src={opt.imageUrls[0]} />
                </button>
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm sm:text-base font-extrabold text-[#173A67] leading-snug">{opt.title}</h4>
                  <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">
                    #{opt.orderNum}
                  </span>
                </div>
                {opt.members.length > 0 ? (
                  <p className="text-xs text-on-surface-variant line-clamp-2">
                    {opt.members.map((m) => m.fullName).join(", ")}
                  </p>
                ) : null}
                {isBlocked ? (
                  <p className="mt-auto text-xs font-bold text-amber-800">Đội/bài thi của bạn</p>
                ) : canEdit ? (
                  <div className="mt-auto flex items-center gap-2">
                    <button
                      aria-label="Bớt 1 điểm"
                      className="h-9 w-9 rounded-xl border border-primary text-primary font-black hover:bg-primary/10 cursor-pointer disabled:opacity-40"
                      disabled={value <= 0}
                      type="button"
                      onClick={() => setOptionPoints(opt.id, value - 1)}
                    >
                      −
                    </button>
                    <input
                      aria-label={`Điểm cho ${opt.title}`}
                      className="w-20 rounded-xl border border-primary bg-white px-2 py-1.5 text-center text-base font-black text-primary"
                      inputMode="numeric"
                      min={0}
                      type="number"
                      value={value}
                      onChange={(e) => setOptionPoints(opt.id, toPoints(e.target.value))}
                    />
                    <button
                      aria-label="Thêm 1 điểm"
                      className="h-9 w-9 rounded-xl border border-primary text-primary font-black hover:bg-primary/10 cursor-pointer disabled:opacity-40"
                      disabled={remaining <= 0}
                      type="button"
                      onClick={() => setOptionPoints(opt.id, value + 1)}
                    >
                      +
                    </button>
                    {value > 0 ? (
                      <button
                        className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                        type="button"
                        onClick={() => setOptionPoints(opt.id, 0)}
                      >
                        Rút
                      </button>
                    ) : null}
                  </div>
                ) : value > 0 ? (
                  <p className="mt-auto text-xs font-bold text-primary">Bạn đã cho {value} điểm</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50/40 p-4 sm:p-5">
          <p className="text-sm font-semibold text-amber-950">
            {overBudget
              ? `Tổng ${draftTotal} điểm vượt quá ${budget} điểm được phân bổ.`
              : `Đã chia ${draftTotal}/${budget} điểm.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {!isPractice && voter && voter.used > 0 ? (
              <button
                className="rounded-xl border border-rose-400 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                disabled={saving}
                type="button"
                onClick={() => submit({}, "Rút toàn bộ điểm bạn đã bình chọn?")}
              >
                Rút toàn bộ điểm
              </button>
            ) : null}
            <button
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-dusty-dark transition cursor-pointer disabled:opacity-50"
              disabled={saving || overBudget || (!isPractice && !isDirty)}
              type="button"
              onClick={() => submit(draft)}
            >
              {saving ? "Đang lưu..." : isPractice ? "Lưu thử" : "Lưu điểm bình chọn"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
