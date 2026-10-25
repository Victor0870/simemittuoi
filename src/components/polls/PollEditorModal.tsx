"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { resizeImageFile } from "@/lib/image-resize";
import type { JudgeMember, PollDetail, PollOption } from "@/lib/data/polls";
import type { PollScheduleMode } from "@/lib/polls/phase";
import { EmployeeSuggestInput, type EmployeeSuggestion } from "@/components/polls/EmployeeSuggestInput";
import { EMPTY_REWARD_MONEY, REWARD_KINDS, type RewardMoney } from "@/lib/polls/reward-money";
import {
  POINTS_BUDGET_MAX,
  POINTS_DEFAULT,
  POINTS_PREDICTION_QUESTION,
  SUBMISSION_MODE_LABEL,
  VOTE_MODE_LABEL,
  normalizePointsBudget,
  type PollSubmissionMode,
  type PollVoteMode,
} from "@/lib/polls/vote-mode";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export type OptionFormState = {
  id?: string;
  title: string;
  description: string;
  imageUrls: string[];
  members: Array<{ fullName: string; employeeCode: string }>;
};

function ParticipationPointsFields({
  voterRewardPoints,
  entryRewardPoints,
  onVoterChange,
  onEntryChange,
}: {
  voterRewardPoints: number;
  entryRewardPoints: number;
  onVoterChange: (value: number) => void;
  onEntryChange: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <span className="block text-sm font-extrabold text-[#173A67]">Điểm tham gia bình chọn</span>
        <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
          Cộng cho đoàn viên đã đăng nhập ngay khi gửi phiếu. Nhập 0 nếu không thưởng.
        </span>
        <span className="mt-3 flex items-center gap-2">
          <input
            className="w-28 rounded-xl border border-amber-400 bg-white px-3 py-2 text-center text-title-md font-black text-amber-700"
            min={0}
            type="number"
            value={voterRewardPoints}
            onChange={(e) => onVoterChange(Number(e.target.value))}
          />
          <span className="text-xs font-bold text-amber-900">điểm / người</span>
        </span>
      </label>
      <label className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <span className="block text-sm font-extrabold text-[#173A67]">Điểm tham gia dự thi</span>
        <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
          Cộng khi tổng kết, theo mã nhân viên gắn trên từng tác phẩm. Mỗi mã được cộng một lần. Nhập 0 nếu không thưởng.
        </span>
        <span className="mt-3 flex items-center gap-2">
          <input
            className="w-28 rounded-xl border border-primary bg-white px-3 py-2 text-center text-title-md font-black text-primary"
            min={0}
            type="number"
            value={entryRewardPoints}
            onChange={(e) => onEntryChange(Number(e.target.value))}
          />
          <span className="text-xs font-bold text-[#173A67]">điểm / mã NV</span>
        </span>
      </label>
    </div>
  );
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialPoll?: PollDetail | null;
  mode?: "create" | "edit";
};

export function PollEditorModal({
  isOpen,
  onClose,
  onSaved,
  initialPoll,
  mode = "edit",
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pollType, setPollType] = useState<"quiz" | "vote">("vote");
  const [accessType, setAccessType] = useState<"members_only" | "free">("free");
  const [contentType, setContentType] = useState<"text" | "image">("image");
  const [isActive, setIsActive] = useState(true);
  const [scheduleMode, setScheduleMode] = useState<PollScheduleMode>("open");
  const [opensAtLocal, setOpensAtLocal] = useState("");
  const [votingEndsAtLocal, setVotingEndsAtLocal] = useState("");
  const [maxVotesPerUser, setMaxVotesPerUser] = useState(3);
  const [maxGuestVotes, setMaxGuestVotes] = useState(250);
  const [hasPrediction, setHasPrediction] = useState(true);
  const [predictionQuestion, setPredictionQuestion] = useState(
    "Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?",
  );
  const [voterRewardPoints, setVoterRewardPoints] = useState(10);
  const [entryRewardPoints, setEntryRewardPoints] = useState(0);
  const [predictorRewardPoints, setPredictorRewardPoints] = useState(50);
  const [voteMode, setVoteMode] = useState<PollVoteMode>("standard");
  const [pointsPerParticipant, setPointsPerParticipant] = useState(POINTS_DEFAULT);
  const [pointsPerNonParticipant, setPointsPerNonParticipant] = useState(POINTS_DEFAULT);
  const [allowSelfVote, setAllowSelfVote] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<PollSubmissionMode>("admin");
  const [submissionDeadlineLocal, setSubmissionDeadlineLocal] = useState("");

  // Judge state
  const [hasJudges, setHasJudges] = useState(false);
  const [judgeWeightPercent, setJudgeWeightPercent] = useState(30);
  const [judgeList, setJudgeList] = useState<JudgeMember[]>([]);
  const [judgeCodeInput, setJudgeCodeInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Union Contest points
  const [isUnionContest, setIsUnionContest] = useState(true);
  const [firstPrizePoints, setFirstPrizePoints] = useState(50);
  const [secondPrizePoints, setSecondPrizePoints] = useState(40);
  const [thirdPrizePoints, setThirdPrizePoints] = useState(30);
  const [consolationPrizePoints, setConsolationPrizePoints] = useState(20);
  const [consolationPrizeCount, setConsolationPrizeCount] = useState(2);
  const [rewardMoney, setRewardMoney] = useState<RewardMoney>(EMPTY_REWARD_MONEY);

  // Options State
  const [options, setOptions] = useState<OptionFormState[]>([
    { title: "Tác phẩm 01", description: "", imageUrls: [], members: [{ fullName: "", employeeCode: "" }] },
    { title: "Tác phẩm 02", description: "", imageUrls: [], members: [{ fullName: "", employeeCode: "" }] },
  ]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "options" | "prizes">("options");

  // Load initial poll data when modal opens or initialPoll changes
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccess(null);
    setLookupError(null);
    setJudgeCodeInput("");

    if (initialPoll && mode === "edit") {
      setTitle(initialPoll.title || "");
      setDescription(initialPoll.description || "");
      setPollType(initialPoll.pollType || "vote");
      setAccessType(initialPoll.accessType || "free");
      setContentType(initialPoll.contentType || "image");
      setIsActive(initialPoll.isActive !== false);
      setScheduleMode(initialPoll.status === "upcoming" ? "upcoming" : "open");
      setOpensAtLocal(toLocalInput(initialPoll.opensAt));
      setVotingEndsAtLocal(toLocalInput(initialPoll.votingEndsAt));
      setMaxVotesPerUser(initialPoll.maxVotesPerUser || 3);
      setMaxGuestVotes(initialPoll.maxGuestVotes ?? 250);
      setHasPrediction(Boolean(initialPoll.hasPrediction));
      setPredictionQuestion(
        initialPoll.predictionQuestion ||
          "Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?",
      );
      setVoterRewardPoints(initialPoll.voterRewardPoints ?? 10);
      setEntryRewardPoints(initialPoll.entryRewardPoints ?? 0);
      setPredictorRewardPoints(initialPoll.predictorRewardPoints ?? 50);
      setVoteMode(initialPoll.voteMode ?? "standard");
      setPointsPerParticipant(initialPoll.pointsPerParticipant ?? POINTS_DEFAULT);
      setPointsPerNonParticipant(initialPoll.pointsPerNonParticipant ?? POINTS_DEFAULT);
      setAllowSelfVote(Boolean(initialPoll.allowSelfVote));
      setSubmissionMode(initialPoll.submissionMode ?? "admin");
      setSubmissionDeadlineLocal(toLocalInput(initialPoll.submissionDeadline ?? null));
      setHasJudges(Boolean(initialPoll.hasJudges));
      setJudgeWeightPercent(initialPoll.judgeWeightPercent ?? 30);
      setJudgeList(initialPoll.judgeList || []);
      setIsUnionContest(Boolean(initialPoll.isUnionContest));
      setFirstPrizePoints(initialPoll.firstPrizePoints ?? 50);
      setSecondPrizePoints(initialPoll.secondPrizePoints ?? 40);
      setThirdPrizePoints(initialPoll.thirdPrizePoints ?? 30);
      setConsolationPrizePoints(initialPoll.consolationPrizePoints ?? 20);
      setConsolationPrizeCount(initialPoll.consolationPrizeCount ?? 2);
      setRewardMoney(initialPoll.rewardMoney ?? EMPTY_REWARD_MONEY);

      if (initialPoll.options && initialPoll.options.length > 0) {
        setOptions(
          initialPoll.options.map((opt) => ({
            id: opt.id,
            title: opt.title || "",
            description: opt.description || "",
            imageUrls: opt.imageUrls || [],
            members:
              opt.members && opt.members.length > 0
                ? opt.members.map((m) => ({
                    fullName: m.fullName || "",
                    employeeCode: m.employeeCode || "",
                  }))
                : [{ fullName: "", employeeCode: "" }],
          })),
        );
      }
    } else if (mode === "create") {
      setTitle("");
      setDescription("");
      setPollType("vote");
      setAccessType("free");
      setContentType("image");
      setScheduleMode("open");
      setOpensAtLocal("");
      setVotingEndsAtLocal("");
      setMaxVotesPerUser(3);
      setVoterRewardPoints(10);
      setEntryRewardPoints(0);
      setHasPrediction(true);
      setVoteMode("standard");
      setPointsPerParticipant(POINTS_DEFAULT);
      setPointsPerNonParticipant(POINTS_DEFAULT);
      setAllowSelfVote(false);
      setSubmissionMode("admin");
      setSubmissionDeadlineLocal("");
      setHasJudges(false);
      setJudgeWeightPercent(30);
      setJudgeList([]);
      setRewardMoney(EMPTY_REWARD_MONEY);
      setOptions([
        { title: "Tác phẩm 01", description: "", imageUrls: [], members: [{ fullName: "", employeeCode: "" }] },
        { title: "Tác phẩm 02", description: "", imageUrls: [], members: [{ fullName: "", employeeCode: "" }] },
        { title: "Tác phẩm 03", description: "", imageUrls: [], members: [{ fullName: "", employeeCode: "" }] },
      ]);
    }
  }, [isOpen, initialPoll, mode]);

  if (!isOpen) return null;

  // Add / Remove options
  function handleAddOption() {
    setOptions((prev) => [
      ...prev,
      {
        title: `Tác phẩm ${prev.length + 1 < 10 ? `0${prev.length + 1}` : prev.length + 1}`,
        description: "",
        imageUrls: [],
        members: [{ fullName: "", employeeCode: "" }],
      },
    ]);
  }

  function handleRemoveOption(index: number) {
    if (submissionMode !== "player" && options.length <= 2) {
      alert("Chương trình cần có ít nhất 2 tác phẩm/lựa chọn.");
      return;
    }
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  // Member management inside option
  function handleAddMember(optIndex: number) {
    setOptions((prev) => {
      const next = [...prev];
      next[optIndex].members.push({ fullName: "", employeeCode: "" });
      return next;
    });
  }

  function handlePickMember(optIndex: number, memIndex: number, emp: EmployeeSuggestion) {
    const duplicate = options[optIndex].members.some(
      (m, i) => i !== memIndex && m.employeeCode.trim().toUpperCase() === emp.employeeCode.toUpperCase(),
    );
    if (duplicate) {
      window.alert(`${emp.fullName} (${emp.employeeCode}) đã có trong tác phẩm này.`);
      return;
    }
    setOptions((prev) => {
      const nextMembers = prev[optIndex].members.map((m, i) =>
        i === memIndex ? { fullName: emp.fullName, employeeCode: emp.employeeCode } : m,
      );
      if (memIndex === nextMembers.length - 1) {
        nextMembers.push({ fullName: "", employeeCode: "" });
      }
      return prev.map((opt, i) => (i === optIndex ? { ...opt, members: nextMembers } : opt));
    });
  }

  function handleRemoveMember(optIndex: number, memIndex: number) {
    setOptions((prev) => {
      const next = [...prev];
      next[optIndex].members = next[optIndex].members.filter((_, i) => i !== memIndex);
      return next;
    });
  }

  // Upload & resize image
  async function handleImageUpload(optIndex: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    const currentImgs = [...options[optIndex].imageUrls];

    for (let i = 0; i < files.length; i++) {
      if (currentImgs.length >= 3) break;
      const file = files[i];
      try {
        const resizedDataUrl = await resizeImageFile(file, 1200, 900, 0.78);
        currentImgs.push(resizedDataUrl);
      } catch (err) {
        console.error("Lỗi resize ảnh:", err);
      }
    }

    setOptions((prev) => {
      const next = [...prev];
      next[optIndex].imageUrls = currentImgs;
      return next;
    });
  }

  function handleAddImageUrl(optIndex: number) {
    const url = prompt("Nhập đường link (URL) hình ảnh:");
    if (!url || !url.trim()) return;
    if (options[optIndex].imageUrls.length >= 3) {
      alert("Tối đa 3 ảnh cho mỗi tác phẩm.");
      return;
    }
    setOptions((prev) => {
      const next = [...prev];
      next[optIndex].imageUrls.push(url.trim());
      return next;
    });
  }

  function handleRemoveImage(optIndex: number, imgIndex: number) {
    setOptions((prev) => {
      const next = [...prev];
      next[optIndex].imageUrls = next[optIndex].imageUrls.filter((_, i) => i !== imgIndex);
      return next;
    });
  }

  // Judge management
  async function handleLookupAndAddJudge() {
    const code = judgeCodeInput.trim().toUpperCase();
    if (!code) {
      setLookupError("Vui lòng nhập mã số nhân viên của Giám khảo.");
      return;
    }

    if (judgeList.some((j) => j.employeeCode.toUpperCase() === code)) {
      setLookupError(`Giám khảo có mã ${code} đã tồn tại trong danh sách.`);
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/employees/lookup?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok || !data.found) {
        setLookupError(data.error || `Không tìm thấy nhân viên với mã ${code}.`);
        return;
      }

      setJudgeList((prev) => [
        ...prev,
        {
          employeeCode: data.employeeCode,
          fullName: data.fullName,
          department: data.department || null,
          userId: data.userId || null,
        },
      ]);
      setJudgeCodeInput("");
      setLookupError(null);
    } catch {
      setLookupError("Lỗi kết nối khi tra cứu mã nhân viên.");
    } finally {
      setLookupLoading(false);
    }
  }

  function handleRemoveJudge(index: number) {
    setJudgeList((prev) => prev.filter((_, i) => i !== index));
  }

  // Save changes
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Vui lòng nhập tên chương trình bình chọn.");
      return;
    }

    if (submissionMode !== "player" && options.length < 2) {
      setError("Cần có ít nhất 2 tác phẩm/lựa chọn.");
      return;
    }

    for (let i = 0; i < options.length; i++) {
      if (!options[i].title.trim()) {
        setError(`Vui lòng nhập tên cho Tác phẩm #${i + 1}`);
        return;
      }
    }

    if (hasJudges && judgeList.length === 0) {
      setError("Bạn đang bật tính năng Ban Giám Khảo. Vui lòng thêm ít nhất 1 thành viên Ban Giám Khảo.");
      setActiveTab("general");
      return;
    }

    if (
      scheduleMode === "upcoming" &&
      opensAtLocal &&
      votingEndsAtLocal &&
      new Date(votingEndsAtLocal) <= new Date(opensAtLocal)
    ) {
      setError("Giờ dừng nhận phiếu phải sau giờ mở bình chọn.");
      setActiveTab("general");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        pollId: initialPoll?.id,
        title,
        description,
        pollType,
        accessType,
        contentType,
        isActive,
        scheduleMode,
        opensAt: scheduleMode === "upcoming" ? fromLocalInput(opensAtLocal) : null,
        votingEndsAt: fromLocalInput(votingEndsAtLocal),
        maxVotesPerUser,
        maxGuestVotes,
        hasPrediction,
        voteMode,
        pointsPerParticipant,
        pointsPerNonParticipant,
        allowSelfVote,
        submissionMode,
        submissionDeadline: submissionMode === "player" ? fromLocalInput(submissionDeadlineLocal) : null,
        predictionQuestion,
        voterRewardPoints,
        entryRewardPoints,
        predictorRewardPoints,
        hasJudges,
        judgeWeightPercent,
        judgeList,
        isUnionContest,
        firstPrizePoints,
        secondPrizePoints,
        thirdPrizePoints,
        consolationPrizePoints,
        consolationPrizeCount,
        rewardMoney,
        options,
      };

      const endpoint = mode === "edit" ? "/api/polls/update" : "/api/polls/create";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi lưu cài đặt bình chọn");

      setSuccess(data.message || "Đã lưu cài đặt thành công!");
      setTimeout(() => {
        if (onSaved) onSaved();
        onClose();
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[96dvh] sm:max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl bg-surface-container-lowest shadow-2xl border border-outline-variant overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant/70 bg-[#F4F9F8] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#173A67] text-white shadow-xs">
              <MaterialIcon className="text-[18px] sm:text-[22px]" name="settings" />
            </span>
            <div>
              <h2 className="text-sm sm:text-title-lg font-black text-[#173A67] leading-snug">
                {mode === "edit" ? "Cài Đặt & Chỉnh Sửa Bình Chọn" : "Tạo Chương Trình Mới"}
              </h2>
              <p className="text-[11px] sm:text-body-xs text-[#27496D] line-clamp-1 sm:line-clamp-none">
                Tác phẩm, tải ảnh lên, danh sách đoàn viên và thể lệ vote
              </p>
            </div>
          </div>
          <button
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition cursor-pointer text-xs sm:text-sm shrink-0"
            type="button"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation (High contrast, crystal clear, never squished) */}
        <div className="shrink-0 border-b border-slate-200 bg-[#EDF3F7] p-2.5 sm:px-6 sm:py-3 shadow-inner">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
            <button
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "options"
                  ? "bg-[#173A67] text-white shadow-md ring-1 ring-[#173A67]"
                  : "bg-white text-slate-700 hover:bg-white hover:text-[#173A67] border border-slate-300/80 shadow-2xs"
              }`}
              type="button"
              onClick={() => setActiveTab("options")}
            >
              <MaterialIcon className={`text-[18px] ${activeTab === "options" ? "text-amber-300" : "text-[#173A67]"}`} name="collections" />
              <span>1. Tác Phẩm & Đoàn Viên</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                activeTab === "options" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}>
                {options.length}
              </span>
            </button>

            <button
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "general"
                  ? "bg-[#173A67] text-white shadow-md ring-1 ring-[#173A67]"
                  : "bg-white text-slate-700 hover:bg-white hover:text-[#173A67] border border-slate-300/80 shadow-2xs"
              }`}
              type="button"
              onClick={() => setActiveTab("general")}
            >
              <MaterialIcon className={`text-[18px] ${activeTab === "general" ? "text-amber-300" : "text-[#173A67]"}`} name="tune" />
              <span>2. Cài Đặt Vote & Thể Lệ</span>
            </button>

            <button
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "prizes"
                  ? "bg-[#173A67] text-white shadow-md ring-1 ring-[#173A67]"
                  : "bg-white text-slate-700 hover:bg-white hover:text-[#173A67] border border-slate-300/80 shadow-2xs"
              }`}
              type="button"
              onClick={() => setActiveTab("prizes")}
            >
              <MaterialIcon className={`text-[18px] ${activeTab === "prizes" ? "text-amber-300" : "text-[#173A67]"}`} name="emoji_events" />
              <span>3. Giải Thưởng & Dự Đoán</span>
            </button>
          </div>
        </div>

        {/* Banners */}
        {error ? (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-error/40 bg-error-container/40 p-3 text-sm text-on-error-container">
            <MaterialIcon className="text-error" name="error" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 font-medium">
            <MaterialIcon className="text-emerald-600" name="check_circle" />
            <span>{success}</span>
          </div>
        ) : null}

        {/* Form Body */}
        <form className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 space-y-6" onSubmit={handleSubmit}>
          {/* TAB 1: OPTIONS & MEMBERS & IMAGES */}
          {activeTab === "options" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary/5 p-4 border border-primary/20">
                <div>
                  <h3 className="font-extrabold text-[#173A67] text-base">
                    Danh Sách Tác Phẩm / Phương Án Bình Chọn ({options.length})
                  </h3>
                  <p className="text-body-xs text-on-surface-variant mt-0.5">
                    Mỗi tác phẩm có thể tải lên tối đa 3 ảnh (tự động nén tối ưu web) và nhập danh sách đoàn viên tham gia.
                  </p>
                </div>
                <button
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-dusty-dark transition cursor-pointer"
                  type="button"
                  onClick={handleAddOption}
                >
                  <MaterialIcon className="text-[18px]" name="add_circle" />
                  <span>+ Thêm Tác Phẩm Mới</span>
                </button>
              </div>

              <ParticipationPointsFields
                entryRewardPoints={entryRewardPoints}
                voterRewardPoints={voterRewardPoints}
                onEntryChange={setEntryRewardPoints}
                onVoterChange={setVoterRewardPoints}
              />

              <div className="space-y-5">
                {options.map((opt, optIdx) => (
                  <div
                    key={opt.id || optIdx}
                    className="rounded-2xl border border-outline-variant/80 bg-surface-container-low/40 p-5 space-y-4 hover:border-primary/50 transition shadow-2xs"
                  >
                    {/* Header of Option */}
                    <div className="flex items-center justify-between border-b border-outline-variant/50 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#173A67] text-white text-xs font-extrabold">
                          #{optIdx + 1}
                        </span>
                        <span className="font-bold text-[#173A67] text-sm">
                          {opt.title || `Tác phẩm ${optIdx + 1}`}
                        </span>
                      </div>
                      <button
                        className="flex items-center gap-1 text-xs font-bold text-error hover:underline cursor-pointer"
                        type="button"
                        onClick={() => handleRemoveOption(optIdx)}
                      >
                        <MaterialIcon className="text-[14px]" name="delete" />
                        <span>Xóa tác phẩm này</span>
                      </button>
                    </div>

                    {/* Title & Description */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-label-xs font-bold text-[#173A67]" htmlFor={`modal-opt-title-${optIdx}`}>
                          Tên tác phẩm / phương án <span className="text-error">*</span>
                        </label>
                        <input
                          id={`modal-opt-title-${optIdx}`}
                          className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm font-semibold text-on-surface focus:border-primary"
                          placeholder="VD: Bài dự thi số 1 – Đội Sản xuất"
                          required
                          type="text"
                          value={opt.title}
                          onChange={(e) => {
                            const next = [...options];
                            next[optIdx].title = e.target.value;
                            setOptions(next);
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-label-xs font-bold text-[#173A67]" htmlFor={`modal-opt-desc-${optIdx}`}>
                          Mô tả bài dự thi / phương án:
                        </label>
                        <input
                          id={`modal-opt-desc-${optIdx}`}
                          className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface focus:border-primary"
                          placeholder="Ý tưởng, chủ đề, nội dung chính..."
                          type="text"
                          value={opt.description}
                          onChange={(e) => {
                            const next = [...options];
                            next[optIdx].description = e.target.value;
                            setOptions(next);
                          }}
                        />
                      </div>
                    </div>

                    {/* Image Upload Gallery */}
                    {contentType === "image" && (
                      <div className="space-y-2 rounded-xl bg-white p-3.5 border border-outline-variant/60">
                        <div className="flex items-center justify-between">
                          <span className="text-label-xs font-bold text-[#173A67] flex items-center gap-1.5">
                            <MaterialIcon className="text-[16px] text-primary" name="photo_camera" />
                            Hình ảnh tác phẩm ({opt.imageUrls.length}/3 ảnh)
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            Tự động nén tối ưu web khi tải từ máy ảnh
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          {opt.imageUrls.map((imgUrl, imgIdx) => (
                            <div
                              key={imgIdx}
                              className="relative h-24 w-28 overflow-hidden rounded-xl border border-outline-variant bg-slate-50 shadow-xs group"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                alt=""
                                className="h-full w-full object-cover transition group-hover:scale-105"
                                src={imgUrl}
                              />
                              <button
                                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black transition cursor-pointer text-xs"
                                title="Xóa ảnh này"
                                type="button"
                                onClick={() => handleRemoveImage(optIdx, imgIdx)}
                              >
                                ✕
                              </button>
                            </div>
                          ))}

                          {opt.imageUrls.length < 3 ? (
                            <div className="flex items-center gap-2">
                              <label className="flex h-24 w-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition text-center p-2">
                                <MaterialIcon className="text-primary text-[24px]" name="add_photo_alternate" />
                                <span className="text-[11px] font-bold text-primary mt-1">Tải ảnh từ máy</span>
                                <input
                                  accept="image/*"
                                  className="hidden"
                                  multiple
                                  type="file"
                                  onChange={(e) => handleImageUpload(optIdx, e.target.files)}
                                />
                              </label>

                              <button
                                className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low hover:bg-surface-container-high transition text-center p-2"
                                title="Nhập liên kết ảnh trực tiếp"
                                type="button"
                                onClick={() => handleAddImageUrl(optIdx)}
                              >
                                <MaterialIcon className="text-[20px] text-on-surface-variant" name="link" />
                                <span className="text-[11px] font-semibold text-on-surface-variant mt-1">Dán link ảnh</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* Member Roster for Union Contest */}
                    {isUnionContest && (
                      <div className="space-y-2 rounded-xl bg-white p-3.5 border border-outline-variant/60">
                        <div className="flex items-center justify-between">
                          <span className="text-label-xs font-bold text-[#173A67] flex items-center gap-1.5">
                            <MaterialIcon className="text-[16px] text-amber-600" name="groups" />
                            Danh sách đoàn viên thực hiện tác phẩm này
                          </span>
                          <button
                            className="flex items-center gap-1 text-primary text-xs font-bold hover:underline cursor-pointer"
                            type="button"
                            onClick={() => handleAddMember(optIdx)}
                          >
                            <MaterialIcon className="text-[14px]" name="add" />
                            <span>+ Thêm thành viên</span>
                          </button>
                        </div>

                        <div className="space-y-2 pt-1">
                          {opt.members.map((mem, memIdx) => (
                            <div key={memIdx} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <EmployeeSuggestInput
                                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-1.5 text-base sm:text-xs text-on-surface placeholder:text-outline focus:border-primary"
                                  placeholder="Gõ tên hoặc mã NV để chọn nhanh"
                                  value={mem.fullName}
                                  onChange={(text) => {
                                    const next = [...options];
                                    next[optIdx].members[memIdx].fullName = text;
                                    setOptions(next);
                                  }}
                                  onPick={(emp) => handlePickMember(optIdx, memIdx, emp)}
                                />
                              </div>
                              <div className="w-28 sm:w-36 shrink-0">
                                <EmployeeSuggestInput
                                  align="right"
                                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-1.5 text-base sm:text-xs text-on-surface placeholder:text-outline focus:border-primary"
                                  placeholder="Mã NV"
                                  value={mem.employeeCode}
                                  onChange={(text) => {
                                    const next = [...options];
                                    next[optIdx].members[memIdx].employeeCode = text;
                                    setOptions(next);
                                  }}
                                  onPick={(emp) => handlePickMember(optIdx, memIdx, emp)}
                                />
                              </div>
                              {opt.members.length > 1 ? (
                                <button
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-error hover:bg-error/10 text-xs"
                                  title="Xóa thành viên"
                                  type="button"
                                  onClick={() => handleRemoveMember(optIdx, memIdx)}
                                >
                                  ✕
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-center pt-2">
                <button
                  className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-primary px-6 py-3 font-bold text-primary hover:bg-primary/5 transition cursor-pointer"
                  type="button"
                  onClick={handleAddOption}
                >
                  <MaterialIcon className="text-[20px]" name="add_circle" />
                  <span>+ Thêm Tác Phẩm / Phương Án Tiếp Theo</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL SETTINGS & VOTING RULES */}
          {activeTab === "general" && (
            <div className="space-y-6">
              {/* Poll Title & Description */}
              <div className="space-y-4">
                <div>
                  <label className="text-label-sm font-bold text-[#173A67]" htmlFor="m-poll-title">
                    Tên chương trình bình chọn <span className="text-error">*</span>
                  </label>
                  <input
                    id="m-poll-title"
                    className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-body-md font-semibold text-on-surface focus:border-primary"
                    placeholder="VD: Bình chọn bài dự thi – Cuộc thi Sáng kiến cải tiến 2026"
                    required
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-label-sm font-bold text-[#173A67]" htmlFor="m-poll-desc">
                    Mô tả chương trình & Thể lệ:
                  </label>
                  <textarea
                    id="m-poll-desc"
                    className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-4 py-2 text-body-sm text-on-surface focus:border-primary"
                    placeholder="Lời dẫn chương trình, quy định chấm điểm, lời chúc..."
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* Active / Inactive Status Setting */}
              <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-[#173A67] flex items-center gap-2">
                      <MaterialIcon className={`text-[18px] ${isActive ? "text-emerald-600" : "text-slate-500"}`} name="power_settings_new" />
                      <span>Trạng thái hoạt động (Active / Inactive)</span>
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {isActive
                        ? "🟢 Đang kích hoạt (Active) – Chương trình hiển thị công khai trên website cho mọi người tham gia."
                        : "⚪ Tạm ngưng (Inactive) – Chương trình bị ẩn khỏi website, chỉ Quản trị viên mới thấy để tiếp tục biên tập."}
                    </p>
                  </div>

                  <div className="flex items-center rounded-xl bg-white p-1 border border-outline-variant shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setIsActive(true)}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-300" />
                      <span>Active</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsActive(false)}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        !isActive
                          ? "bg-slate-700 text-white shadow-xs"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                      <span>Inactive</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-sky-300/70 bg-sky-50/60 p-4 sm:p-5 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-[#173A67] flex items-center gap-2">
                    <MaterialIcon className="text-[18px] text-sky-600" name="schedule" />
                    <span>Giai đoạn bình chọn</span>
                  </h4>
                  {initialPoll?.status === "closed" && mode === "edit" ? (
                    <p className="text-xs text-amber-800 mt-0.5">
                      Chương trình đã đóng & trao giải. Giai đoạn bên dưới chỉ áp dụng khi bấm &quot;Mở lại&quot;.
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        value: "upcoming",
                        icon: "school",
                        title: "Sắp mở (bình chọn thử)",
                        desc: "Mọi người xem trước tác phẩm và bấm thử để làm quen. Phiếu thử không được ghi nhận.",
                      },
                      {
                        value: "open",
                        icon: "how_to_vote",
                        title: "Đang mở (nhận phiếu thật)",
                        desc: "Phiếu bình chọn được ghi nhận và tính kết quả ngay.",
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      className={`flex items-start gap-2.5 rounded-xl border-2 p-3 text-left transition cursor-pointer ${
                        scheduleMode === opt.value
                          ? "border-sky-600 bg-white shadow-xs"
                          : "border-transparent bg-white/60 hover:border-sky-300"
                      }`}
                      type="button"
                      onClick={() => setScheduleMode(opt.value)}
                    >
                      <MaterialIcon
                        className={`text-[22px] shrink-0 ${scheduleMode === opt.value ? "text-sky-600" : "text-slate-400"}`}
                        name={scheduleMode === opt.value ? "radio_button_checked" : "radio_button_unchecked"}
                      />
                      <span>
                        <span className="flex items-center gap-1.5 text-sm font-extrabold text-[#173A67]">
                          <MaterialIcon className="text-[16px]" name={opt.icon} />
                          {opt.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-on-surface-variant">{opt.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {scheduleMode === "upcoming" ? (
                    <label className="block">
                      <span className="text-label-xs font-bold text-[#173A67]">Tự mở nhận phiếu lúc</span>
                      <input
                        className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-base sm:text-sm text-on-surface focus:border-primary"
                        type="datetime-local"
                        value={opensAtLocal}
                        onChange={(e) => setOpensAtLocal(e.target.value)}
                      />
                      <span className="mt-1 block text-[11px] text-on-surface-variant">
                        {opensAtLocal
                          ? new Date(opensAtLocal).getTime() <= Date.now()
                            ? "⚠️ Thời điểm này đã qua: lưu xong chương trình sẽ nhận phiếu thật ngay."
                            : "Tới giờ hệ thống tự chuyển sang nhận phiếu thật."
                          : "Để trống nếu muốn tự bấm \"Mở bình chọn ngay\"."}
                      </span>
                    </label>
                  ) : null}
                  <label className="block">
                    <span className="text-label-xs font-bold text-[#173A67]">Tự dừng nhận phiếu lúc (không bắt buộc)</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-base sm:text-sm text-on-surface focus:border-primary"
                      type="datetime-local"
                      value={votingEndsAtLocal}
                      onChange={(e) => setVotingEndsAtLocal(e.target.value)}
                    />
                    <span className="mt-1 block text-[11px] text-on-surface-variant">
                      Hết giờ sẽ ngừng nhận phiếu; trao giải vẫn bấm &quot;Đóng &amp; Trao giải&quot; như cũ.
                    </span>
                  </label>
                </div>
              </div>

              {/* Mode grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-2xl bg-surface-container-low p-4">
                <div>
                  <label className="text-label-xs font-bold text-[#173A67]">Loại bình chọn</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface"
                    value={pollType}
                    onChange={(e) => setPollType(e.target.value as any)}
                  >
                    <option value="vote">Bình chọn kết quả / Vote tác phẩm</option>
                    <option value="quiz">Trả lời câu hỏi trắc nghiệm</option>
                  </select>
                </div>

                <div>
                  <label className="text-label-xs font-bold text-[#173A67]">Phạm vi đối tượng</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface"
                    value={accessType}
                    onChange={(e) => setAccessType(e.target.value as any)}
                  >
                    <option value="free">Công khai / Free (người chưa là đoàn viên phải nhập mã nhân viên)</option>
                    <option value="members_only">Dành riêng cho đoàn viên đã duyệt</option>
                  </select>
                </div>

                <div>
                  <label className="text-label-xs font-bold text-[#173A67]">Hình thức hiển thị</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface"
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value as any)}
                  >
                    <option value="image">Bình chọn theo Hình ảnh (có phóng to)</option>
                    <option value="text">Bình chọn theo Văn bản thuần</option>
                  </select>
                </div>
              </div>

              {/* Chế độ nộp bài */}
              <div className="rounded-2xl border border-outline-variant bg-white p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-[#173A67]">Chế độ nộp bài</h4>
                  <p className="text-xs text-on-surface-variant">
                    Bài người chơi nộp chỉ hiện trong danh sách bình chọn sau khi Ban tổ chức duyệt.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["admin", "player"] as PollSubmissionMode[]).map((value) => (
                    <button
                      key={value}
                      className={`rounded-xl border-2 px-3 py-2.5 text-left text-sm font-bold transition cursor-pointer ${
                        submissionMode === value
                          ? "border-[#173A67] bg-[#173A67]/5 text-[#173A67]"
                          : "border-outline-variant text-on-surface-variant hover:border-[#173A67]/50"
                      }`}
                      type="button"
                      onClick={() => setSubmissionMode(value)}
                    >
                      {SUBMISSION_MODE_LABEL[value]}
                      <span className="block text-xs font-medium text-on-surface-variant">
                        {value === "admin"
                          ? "Ban tổ chức nhập bài thi và thành viên ở thẻ Tác phẩm."
                          : "Đoàn viên đăng nhập tự nộp bài, Ban tổ chức duyệt hoặc từ chối."}
                      </span>
                    </button>
                  ))}
                </div>
                {submissionMode === "player" ? (
                  <label className="block space-y-1">
                    <span className="text-label-xs font-bold text-[#173A67]">Hạn nộp bài (không bắt buộc)</span>
                    <input
                      className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
                      type="datetime-local"
                      value={submissionDeadlineLocal}
                      onChange={(e) => setSubmissionDeadlineLocal(e.target.value)}
                    />
                    <span className="block text-xs text-on-surface-variant">
                      Để trống thì nhận bài đến khi chương trình kết thúc. Ban tổ chức vẫn thêm bài được ở thẻ Tác phẩm.
                    </span>
                  </label>
                ) : null}
              </div>

              {/* Hình thức bình chọn */}
              <div className="rounded-2xl border border-outline-variant bg-white p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-[#173A67]">Hình thức bình chọn</h4>
                  <p className="text-xs text-on-surface-variant">
                    Không đổi được sau khi đã có người bình chọn.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["standard", "points"] as PollVoteMode[]).map((value) => (
                    <button
                      key={value}
                      className={`rounded-xl border-2 px-3 py-2.5 text-left text-sm font-bold transition cursor-pointer ${
                        voteMode === value
                          ? "border-[#173A67] bg-[#173A67]/5 text-[#173A67]"
                          : "border-outline-variant text-on-surface-variant hover:border-[#173A67]/50"
                      }`}
                      type="button"
                      onClick={() => setVoteMode(value)}
                    >
                      {VOTE_MODE_LABEL[value]}
                      <span className="block text-xs font-medium text-on-surface-variant">
                        {value === "standard"
                          ? "Mỗi người chọn tối đa N tác phẩm, mỗi lựa chọn là 1 phiếu."
                          : "Mỗi người/đội có số điểm riêng, tự chia cho một hoặc nhiều bài thi."}
                      </span>
                    </button>
                  ))}
                </div>

                {voteMode === "points" ? (
                  <div className="space-y-3 rounded-xl bg-[#173A67]/5 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-bold text-[#173A67]">Điểm cho người dự thi</span>
                        <input
                          className="w-full rounded-xl border border-primary bg-white px-3 py-2 text-center text-title-md font-black text-primary"
                          max={POINTS_BUDGET_MAX}
                          min={0}
                          type="number"
                          value={pointsPerParticipant}
                          onChange={(e) => setPointsPerParticipant(normalizePointsBudget(e.target.value, 0))}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-bold text-[#173A67]">Điểm cho người không dự thi</span>
                        <input
                          className="w-full rounded-xl border border-primary bg-white px-3 py-2 text-center text-title-md font-black text-primary"
                          max={POINTS_BUDGET_MAX}
                          min={0}
                          type="number"
                          value={pointsPerNonParticipant}
                          onChange={(e) => setPointsPerNonParticipant(normalizePointsBudget(e.target.value, 0))}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      Người dự thi là người có tên (theo mã nhân viên) trong danh sách thành viên của ít nhất một bài thi đã duyệt.
                      Mỗi người chỉ có một số điểm cho cả chương trình, dù có tên trong nhiều bài. Quản trị viên cộng thêm điểm cho từng người ở trang chương trình.
                    </p>
                    <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-[#173A67]">
                      <input
                        checked={allowSelfVote}
                        className="mt-0.5 h-4 w-4 accent-[#173A67]"
                        type="checkbox"
                        onChange={(e) => setAllowSelfVote(e.target.checked)}
                      />
                      <span>Cho phép người dự thi cho điểm bài thi có tên mình</span>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#173A67]">
                        Số lượng tác phẩm mỗi người được vote tối đa
                      </h4>
                      <p className="text-xs text-on-surface-variant">
                        Ví dụ: 3 tác phẩm (mỗi phiếu bầu tương ứng 1 điểm)
                      </p>
                    </div>
                    <input
                      className="w-24 rounded-xl border border-primary bg-primary/5 px-3 py-2 text-center text-title-md font-black text-primary"
                      min={1}
                      type="number"
                      value={maxVotesPerUser}
                      onChange={(e) => setMaxVotesPerUser(Number(e.target.value))}
                    />
                  </div>
                )}

                <div className="border-t border-outline-variant/60 pt-4">
                  <ParticipationPointsFields
                    entryRewardPoints={entryRewardPoints}
                    voterRewardPoints={voterRewardPoints}
                    onEntryChange={setEntryRewardPoints}
                    onVoterChange={setVoterRewardPoints}
                  />
                </div>

                {/* Tính năng an toàn: Giới hạn lượt bình chọn tự do (Free) */}
                {accessType === "free" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-300/80 bg-amber-50/60 p-4 -mx-5 -mb-5 rounded-b-2xl">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-amber-950">
                        <MaterialIcon className="text-[20px] text-amber-700" name="shield" />
                        <h4 className="text-sm font-extrabold">
                          Giới hạn an toàn bình chọn tự do (Chống spam)
                        </h4>
                      </div>
                      <p className="text-xs text-amber-900 max-w-md">
                        Tối đa <strong>{maxGuestVotes}</strong> lượt không đăng nhập. Vượt quá mức này sẽ tự động chặn khách và chỉ cho phép Đoàn viên đăng nhập tiếp tục bình chọn.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-24 rounded-xl border border-amber-400 bg-white px-3 py-2 text-center text-title-md font-black text-amber-950 focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
                        min={10}
                        max={10000}
                        type="number"
                        value={maxGuestVotes}
                        onChange={(e) => setMaxGuestVotes(Number(e.target.value) || 250)}
                      />
                      <span className="text-xs font-bold text-amber-900">lượt</span>
                    </div>
                  </div>
                )}
              </div>

              {/* KHỐI CẤU HÌNH BAN GIÁM KHẢO (BGK) */}
              <div className="rounded-2xl border-2 border-[#173A67]/30 bg-gradient-to-b from-[#173A67]/5 to-transparent p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#173A67]/20 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173A67] text-white shadow-xs">
                      <MaterialIcon className="text-[22px]" name="gavel" />
                    </span>
                    <div>
                      <h4 className="text-base font-extrabold text-[#173A67] leading-tight">
                        Quy Định Ban Giám Khảo (BGK)
                      </h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Tính điểm kết hợp theo trọng số giữa Ban Giám Khảo và người bình chọn khác.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center rounded-xl bg-white p-1 border border-outline-variant shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setHasJudges(true)}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        hasJudges
                          ? "bg-[#173A67] text-white shadow-xs"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      <MaterialIcon className="text-[16px]" name="check_circle" />
                      <span>Có Ban Giám Khảo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasJudges(false)}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        !hasJudges
                          ? "bg-slate-700 text-white shadow-xs"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      <MaterialIcon className="text-[16px]" name="cancel" />
                      <span>Không áp dụng</span>
                    </button>
                  </div>
                </div>

                {hasJudges && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    {/* Tỉ lệ điểm của Ban Giám Khảo */}
                    <div className="rounded-xl border border-primary/20 bg-white p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <label className="text-sm font-bold text-[#173A67] block">
                            Tỉ lệ điểm của Ban Giám Khảo (%):
                          </label>
                          <p className="text-xs text-on-surface-variant">
                            Phần còn lại sẽ dành cho bình chọn của đoàn viên/người tham gia khác.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            className="w-24 rounded-xl border-2 border-primary bg-primary/5 px-3 py-1.5 text-center text-lg font-black text-primary"
                            max={95}
                            min={5}
                            step={5}
                            type="number"
                            value={judgeWeightPercent}
                            onChange={(e) => {
                              const val = Math.min(95, Math.max(5, Number(e.target.value) || 30));
                              setJudgeWeightPercent(val);
                            }}
                          />
                          <span className="text-sm font-extrabold text-[#173A67]">%</span>
                        </div>
                      </div>

                      {/* Trực quan tỉ lệ & Trọng số thang 10 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                              <MaterialIcon className="text-[16px] text-amber-700" name="gavel" />
                              Ban Giám Khảo ({judgeWeightPercent}%)
                            </span>
                            <span className="text-xs font-black text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
                              Hệ số {(judgeWeightPercent / 10).toFixed(1)} đ
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-900 mt-1">
                            Chiếm {judgeWeightPercent}% tổng điểm. Trọng số tối đa là {(judgeWeightPercent / 10).toFixed(1)} / 10 điểm.
                          </p>
                        </div>

                        <div className="rounded-xl border border-blue-300 bg-blue-50/70 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-blue-950 flex items-center gap-1.5">
                              <MaterialIcon className="text-[16px] text-blue-700" name="how_to_vote" />
                              Bình chọn khác ({100 - judgeWeightPercent}%)
                            </span>
                            <span className="text-xs font-black text-blue-900 bg-blue-200/80 px-2 py-0.5 rounded-full">
                              Hệ số {((100 - judgeWeightPercent) / 10).toFixed(1)} đ
                            </span>
                          </div>
                          <p className="text-[11px] text-blue-900 mt-1">
                            Chiếm {100 - judgeWeightPercent}% tổng điểm. Trọng số tối đa là {((100 - judgeWeightPercent) / 10).toFixed(1)} / 10 điểm.
                          </p>
                        </div>
                      </div>

                      {/* Box giải thích công thức */}
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 space-y-1">
                        <div className="font-bold text-[#173A67] flex items-center gap-1">
                          <MaterialIcon className="text-[16px] text-primary" name="info" />
                          <span>Quy tắc tính điểm theo trọng số (Thang 10 điểm):</span>
                        </div>
                        {voteMode === "points" ? (
                          <>
                            <p>
                              • <strong>Điểm BGK</strong> = (Số điểm BGK cho bài thi / <em>Tổng số điểm BGK đã phân bổ</em>) × {(judgeWeightPercent / 10).toFixed(1)}
                            </p>
                            <p>
                              • <strong>Điểm Khác</strong> = (Số điểm người khác cho bài thi / <em>Tổng số điểm người khác đã phân bổ</em>) × {((100 - judgeWeightPercent) / 10).toFixed(1)}
                            </p>
                            <p className="text-amber-800 font-medium">
                              ✦ Vote theo point: mỗi giám khảo dùng điểm cá nhân như người bình chọn khác.
                            </p>
                          </>
                        ) : (
                          <>
                            <p>
                              • <strong>Điểm BGK</strong> = (Số phiếu BGK bầu cho tác phẩm / <em>Tổng số BGK thực tế tham gia bình chọn</em>) × {(judgeWeightPercent / 10).toFixed(1)}
                            </p>
                            <p>
                              • <strong>Điểm Khác</strong> = (Số phiếu khác bầu cho tác phẩm / <em>Tổng số người khác thực tế tham gia bình chọn</em>) × {((100 - judgeWeightPercent) / 10).toFixed(1)}
                            </p>
                            <p className="text-amber-800 font-medium">
                              ✦ Tính theo số người thực tế tham gia bình chọn chứ không chia theo toàn bộ danh sách.
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Danh sách thành viên Ban Giám Khảo */}
                    <div className="rounded-xl border border-primary/20 bg-white p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h5 className="text-sm font-extrabold text-[#173A67] flex items-center gap-2">
                            <span>Danh Sách Ban Giám Khảo</span>
                            <span className="rounded-full bg-[#173A67] px-2 py-0.5 text-[11px] font-bold text-white">
                              {judgeList.length} người
                            </span>
                          </h5>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            Thêm giám khảo bằng cách nhập Mã số nhân viên để hệ thống tự động nhận diện phiếu bầu.
                            Giám khảo chưa có tài khoản không bình chọn được qua link công khai. Trên trang bình chọn, dùng nút QR giám khảo để gửi link riêng.
                          </p>
                        </div>
                      </div>

                      {/* Input tra cứu & thêm */}
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative flex-1 min-w-[200px]">
                            <input
                              className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2 text-xs sm:text-sm font-semibold text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:bg-white"
                              placeholder="Nhập mã nhân viên giám khảo (VD: NV0123)..."
                              type="text"
                              value={judgeCodeInput}
                              onChange={(e) => {
                                setJudgeCodeInput(e.target.value.toUpperCase());
                                setLookupError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleLookupAndAddJudge();
                                }
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={lookupLoading || !judgeCodeInput.trim()}
                            onClick={() => handleLookupAndAddJudge()}
                            className="flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-dusty-dark transition cursor-pointer disabled:opacity-50"
                          >
                            <MaterialIcon className={`text-[16px] ${lookupLoading ? "animate-spin" : ""}`} name={lookupLoading ? "sync" : "person_add"} />
                            <span>{lookupLoading ? "Đang tra cứu..." : "+ Thêm Giám Khảo"}</span>
                          </button>
                        </div>

                        {lookupError && (
                          <p className="text-xs font-bold text-error flex items-center gap-1">
                            <MaterialIcon className="text-[14px]" name="error" />
                            <span>{lookupError}</span>
                          </p>
                        )}
                      </div>

                      {/* Bảng danh sách BGK */}
                      {judgeList.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                          <MaterialIcon className="text-[32px] text-slate-400 mx-auto mb-1" name="groups" />
                          <p className="text-xs font-bold text-slate-700">Chưa có thành viên Ban Giám Khảo nào</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Vui lòng nhập Mã nhân viên ở trên rồi bấm &ldquo;+ Thêm Giám Khảo&rdquo; để thiết lập danh sách.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-outline-variant">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#EDF3F7] text-[#173A67] font-extrabold uppercase">
                              <tr>
                                <th className="px-3 py-2 text-center w-12">STT</th>
                                <th className="px-3 py-2 w-28">Mã NV</th>
                                <th className="px-3 py-2">Họ Và Tên</th>
                                <th className="px-3 py-2">Phòng Ban / Đơn Vị</th>
                                <th className="px-3 py-2 text-center w-16">Xóa</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/60 bg-white">
                              {judgeList.map((j, idx) => (
                                <tr key={j.employeeCode} className="hover:bg-slate-50 transition">
                                  <td className="px-3 py-2 text-center font-bold text-slate-500">
                                    #{idx + 1}
                                  </td>
                                  <td className="px-3 py-2 font-mono font-bold text-[#173A67]">
                                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary font-black">
                                      {j.employeeCode}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-bold text-on-surface">
                                    {j.fullName}
                                  </td>
                                  <td className="px-3 py-2 text-on-surface-variant">
                                    {j.department || "Chưa cập nhật"}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveJudge(idx)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-error hover:bg-error-container/30 transition cursor-pointer"
                                      title="Xóa giám khảo"
                                    >
                                      <MaterialIcon className="text-[16px]" name="delete" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PRIZES & PREDICTIONS */}
          {activeTab === "prizes" && (
            <div className="space-y-6">
              {/* Prediction Question Section */}
              <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-5 space-y-4">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-amber-950 text-sm">
                  <input
                    checked={hasPrediction}
                    className="h-5 w-5 rounded border-amber-400 text-amber-600"
                    type="checkbox"
                    onChange={(e) => setHasPrediction(e.target.checked)}
                  />
                  <span>Kích hoạt câu hỏi: &ldquo;Tìm người dự đoán đúng nhất&rdquo;</span>
                </label>

                {hasPrediction && (
                  <div className="space-y-3 pt-2">
                    {voteMode === "points" ? (
                      <div className="space-y-1">
                        <p className="text-label-xs font-bold text-amber-900">Câu hỏi dự đoán (cố định với Vote theo point):</p>
                        <p className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-on-surface">
                          {POINTS_PREDICTION_QUESTION}
                        </p>
                        <p className="text-xs text-amber-900">
                          Người chơi nhập một số nguyên. Khi Đóng &amp; Trao giải, người có số lệch ít nhất so với tổng điểm
                          của bài hạng Nhất thắng; lệch bằng nhau thì người gửi sớm hơn thắng.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="text-label-xs font-bold text-amber-900" htmlFor="m-pred-q">
                          Nội dung câu hỏi dự đoán:
                        </label>
                        <input
                          id="m-pred-q"
                          className="mt-1 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-on-surface"
                          type="text"
                          value={predictionQuestion}
                          onChange={(e) => setPredictionQuestion(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-900">
                        Điểm thưởng cho người dự đoán đúng nhất (lệch ít nhất, sớm nhất):
                      </span>
                      <input
                        className="w-24 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-center font-bold text-amber-900 text-sm"
                        min={0}
                        type="number"
                        value={predictorRewardPoints}
                        onChange={(e) => setPredictorRewardPoints(Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Union Contest Scoring */}
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-[#173A67] text-sm">
                  <input
                    checked={isUnionContest}
                    className="h-5 w-5 rounded border-primary text-primary"
                    type="checkbox"
                    onChange={(e) => setIsUnionContest(e.target.checked)}
                  />
                  <span>Đây là cuộc thi của đoàn viên (Tự động cộng điểm thi đua khi kết thúc)</span>
                </label>

                {isUnionContest && (
                  <div className="space-y-4 pt-2">
                    <p className="text-xs text-on-surface-variant">
                      Khi Admin bấm kết thúc chương trình, hệ thống sẽ tự động quét danh sách đoàn viên của các tác phẩm đạt giải để cộng điểm thi đua cá nhân.
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <div className="rounded-xl bg-white p-3 border border-outline-variant text-center">
                        <span className="text-[11px] font-bold text-amber-600 block">GIẢI NHẤT</span>
                        <input
                          className="mt-1 w-full text-center text-lg font-black text-amber-600"
                          type="number"
                          value={firstPrizePoints}
                          onChange={(e) => setFirstPrizePoints(Number(e.target.value))}
                        />
                        <span className="text-[10px] text-outline">điểm / người</span>
                      </div>
                      <div className="rounded-xl bg-white p-3 border border-outline-variant text-center">
                        <span className="text-[11px] font-bold text-slate-700 block">GIẢI NHÌ</span>
                        <input
                          className="mt-1 w-full text-center text-lg font-bold text-slate-700"
                          type="number"
                          value={secondPrizePoints}
                          onChange={(e) => setSecondPrizePoints(Number(e.target.value))}
                        />
                        <span className="text-[10px] text-outline">điểm / người</span>
                      </div>
                      <div className="rounded-xl bg-white p-3 border border-outline-variant text-center">
                        <span className="text-[11px] font-bold text-amber-800 block">GIẢI BA</span>
                        <input
                          className="mt-1 w-full text-center text-lg font-bold text-amber-800"
                          type="number"
                          value={thirdPrizePoints}
                          onChange={(e) => setThirdPrizePoints(Number(e.target.value))}
                        />
                        <span className="text-[10px] text-outline">điểm / người</span>
                      </div>
                      <div className="rounded-xl bg-white p-3 border border-outline-variant text-center">
                        <span className="text-[11px] font-bold text-primary block">KHUYẾN KHÍCH</span>
                        <input
                          className="mt-1 w-full text-center text-lg font-bold text-primary"
                          type="number"
                          value={consolationPrizePoints}
                          onChange={(e) => setConsolationPrizePoints(Number(e.target.value))}
                        />
                        <span className="text-[10px] text-outline">điểm / người</span>
                      </div>
                      <div className="rounded-xl bg-white p-3 border border-outline-variant text-center">
                        <span className="text-[11px] font-bold text-on-surface block">SỐ LƯỢNG KK</span>
                        <input
                          className="mt-1 w-full text-center text-lg font-bold text-on-surface"
                          min={0}
                          type="number"
                          value={consolationPrizeCount}
                          onChange={(e) => setConsolationPrizeCount(Number(e.target.value))}
                        />
                        <span className="text-[10px] text-outline">giải khuyến khích</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reward money for the payout list */}
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50/60 p-5 space-y-4">
                <div>
                  <p className="font-bold text-emerald-900 text-sm">Tiền thưởng (VNĐ / người)</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Dùng để tính cột &ldquo;Tổng tiền&rdquo; khi bấm &ldquo;DS nhận thưởng&rdquo; sau khi kết thúc. Nhập 0 nếu
                    không thưởng tiền.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {REWARD_KINDS.map(({ kind, label }) => (
                    <label key={kind} className="rounded-xl bg-white p-3 border border-outline-variant">
                      <span className="block text-[11px] font-bold text-emerald-900">{label.toUpperCase()}</span>
                      <span className="mt-1 flex items-center gap-1">
                        <input
                          className="w-full text-right text-base font-bold text-emerald-900"
                          min={0}
                          step={1000}
                          type="number"
                          value={rewardMoney[kind]}
                          onChange={(e) =>
                            setRewardMoney((m) => ({ ...m, [kind]: Math.max(0, Number(e.target.value) || 0) }))
                          }
                        />
                        <span className="text-xs text-outline">đ</span>
                      </span>
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-emerald-950 cursor-pointer">
                  <input
                    checked={rewardMoney.entryForWinners}
                    className="h-4 w-4"
                    type="checkbox"
                    onChange={(e) => setRewardMoney((m) => ({ ...m, entryForWinners: e.target.checked }))}
                  />
                  <span>Thành viên đội đạt giải nhận thêm tiền tham gia dự thi</span>
                </label>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-outline-variant pt-4">
            <button
              className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition cursor-pointer"
              type="button"
              onClick={onClose}
            >
              Đóng
            </button>
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl bg-primary px-7 py-2.5 text-sm font-bold text-white shadow-md hover:bg-dusty-dark transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                disabled={saving}
                type="submit"
              >
                <MaterialIcon className="text-[18px]" name="save" />
                <span>{saving ? "Đang lưu..." : mode === "edit" ? "Lưu Cập Nhật" : "Tạo Chương Trình"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
