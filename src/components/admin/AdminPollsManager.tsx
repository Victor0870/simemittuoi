"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollDetail, PollSummary } from "@/lib/data/polls";
import { resizeImageFile } from "@/lib/image-resize";

type OptionFormState = {
  title: string;
  description: string;
  imageUrls: string[];
  members: Array<{ fullName: string; employeeCode: string }>;
};

type Props = {
  polls: PollSummary[];
  currentAdminName: string;
};

export function AdminPollsManager({ polls, currentAdminName }: Props) {
  const router = useRouter();

  // Mode: list vs create
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Poll Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pollType, setPollType] = useState<"quiz" | "vote">("vote");
  const [accessType, setAccessType] = useState<"members_only" | "free">("free");
  const [contentType, setContentType] = useState<"text" | "image">("image");
  const [maxVotesPerUser, setMaxVotesPerUser] = useState(3);
  const [hasPrediction, setHasPrediction] = useState(true);
  const [predictionQuestion, setPredictionQuestion] = useState(
    "Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?",
  );
  const [voterRewardPoints, setVoterRewardPoints] = useState(10);
  const [predictorRewardPoints, setPredictorRewardPoints] = useState(50);

  // Union contest points
  const [isUnionContest, setIsUnionContest] = useState(true);
  const [firstPrizePoints, setFirstPrizePoints] = useState(50);
  const [secondPrizePoints, setSecondPrizePoints] = useState(40);
  const [thirdPrizePoints, setThirdPrizePoints] = useState(30);
  const [consolationPrizePoints, setConsolationPrizePoints] = useState(20);
  const [consolationPrizeCount, setConsolationPrizeCount] = useState(2);

  // Options State
  const [options, setOptions] = useState<OptionFormState[]>([
    { title: "Tác phẩm 01", description: "", imageUrls: [], members: [{ fullName: "", employeeCode: "" }] },
    { title: "Tác phẩm 02", description: "", imageUrls: [], members: [{ fullName: "", employeeCode: "" }] },
  ]);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [busyPollId, setBusyPollId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add / Remove option
  function handleAddOption() {
    setOptions([
      ...options,
      {
        title: `Tác phẩm ${options.length + 1 < 10 ? `0${options.length + 1}` : options.length + 1}`,
        description: "",
        imageUrls: [],
        members: [{ fullName: "", employeeCode: "" }],
      },
    ]);
  }

  function handleRemoveOption(index: number) {
    if (options.length <= 2) {
      alert("Chương trình cần có ít nhất 2 tác phẩm/lựa chọn.");
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  }

  // Members in option
  function handleAddMember(optIndex: number) {
    const next = [...options];
    next[optIndex].members.push({ fullName: "", employeeCode: "" });
    setOptions(next);
  }

  function handleRemoveMember(optIndex: number, memIndex: number) {
    const next = [...options];
    next[optIndex].members = next[optIndex].members.filter((_, i) => i !== memIndex);
    setOptions(next);
  }

  // Upload & resize image
  async function handleImageUpload(optIndex: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    const next = [...options];
    const currentImgs = [...next[optIndex].imageUrls];

    for (let i = 0; i < files.length; i++) {
      if (currentImgs.length >= 3) break;
      const file = files[i];
      try {
        // Resize camera photo to clean dataUrl
        const resizedDataUrl = await resizeImageFile(file, 1600, 1200, 0.82);
        currentImgs.push(resizedDataUrl);
      } catch (err) {
        console.error("Lỗi resize ảnh:", err);
      }
    }

    next[optIndex].imageUrls = currentImgs;
    setOptions(next);
  }

  function handleRemoveImage(optIndex: number, imgIndex: number) {
    const next = [...options];
    next[optIndex].imageUrls = next[optIndex].imageUrls.filter((_, i) => i !== imgIndex);
    setOptions(next);
  }

  // Create Poll Submit
  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!title.trim()) {
      setErrorMessage("Vui lòng nhập tên chương trình.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/polls/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          pollType,
          accessType,
          contentType,
          maxVotesPerUser,
          hasPrediction,
          predictionQuestion,
          voterRewardPoints,
          predictorRewardPoints,
          isUnionContest,
          firstPrizePoints,
          secondPrizePoints,
          thirdPrizePoints,
          consolationPrizePoints,
          consolationPrizeCount,
          options,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tạo poll thất bại");

      setSuccessMessage("Tạo chương trình bình chọn mới thành công!");
      setShowCreateForm(false);
      setTitle("");
      setDescription("");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Có lỗi xảy ra khi tạo chương trình.");
    } finally {
      setSubmitting(false);
    }
  }

  // Admin Close Poll & Award prizes
  async function handleClosePoll(pollId: string, pollTitle: string) {
    if (
      !confirm(
        `Xác nhận kết thúc chương trình "${pollTitle}"?\n\nHệ thống sẽ tính toán bảng xếp hạng, tìm người dự đoán đúng nhất và TỰ ĐỘNG CỘNG ĐIỂM THI ĐUA cho các đoàn viên đạt giải.`,
      )
    ) {
      return;
    }

    setBusyPollId(pollId);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/polls/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể kết thúc chương trình");

      setSuccessMessage(data.message || "Đã đóng bình chọn và trao giải thành công!");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Lỗi khi kết thúc chương trình.");
    } finally {
      setBusyPollId(null);
    }
  }

  // Toggle open
  async function handleReopenPoll(pollId: string) {
    setBusyPollId(pollId);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/polls/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, status: "open" }),
      });
      if (!res.ok) throw new Error("Thao tác thất bại");
      setSuccessMessage("Đã mở lại chương trình bình chọn!");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message);
    } finally {
      setBusyPollId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. Header with Admin Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Link
              className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md font-semibold text-on-surface-variant transition hover:border-[#173A67] hover:text-[#173A67]"
              href="/admin/scores"
            >
              <MaterialIcon className="text-[18px] text-amber-600" name="military_tech" />
              <span>Quản lý & Cộng điểm</span>
            </Link>
            <span className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-label-md font-bold text-white shadow-xs">
              <MaterialIcon className="text-[18px]" name="how_to_vote" />
              <span>Quản lý Bình chọn</span>
            </span>
            <Link
              className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md font-semibold text-on-surface-variant transition hover:border-[#173A67] hover:text-[#173A67]"
              href="/admin/users"
            >
              <MaterialIcon className="text-[18px]" name="manage_accounts" />
              <span>Duyệt đoàn viên</span>
            </Link>
          </div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">
            Quản Lý Chương Trình Bình Chọn
          </h1>
          <p className="text-body-md text-[#27496D]">
            Tạo sự kiện vote/trắc nghiệm, kiểm soát mở/đóng và tự động tính kết quả trao giải thi đua.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 font-bold text-white shadow-xs hover:bg-amber-600 transition cursor-pointer"
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <MaterialIcon name={showCreateForm ? "close" : "add"} />
            <span>{showCreateForm ? "Đóng form" : "Tạo chương trình mới"}</span>
          </button>
          <Link
            className="rounded-xl border-2 border-[#173A67] px-4 py-2 font-bold text-[#173A67] hover:bg-[#173A67] hover:text-white transition"
            href="/"
          >
            ← Về trang chủ
          </Link>
        </div>
      </div>

      {/* Success / Error Banners */}
      {successMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-xs">
          <MaterialIcon className="text-[24px] text-emerald-600 shrink-0" name="check_circle" />
          <p className="text-body-md font-medium">{successMessage}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-error/40 bg-error-container/40 p-4 text-on-error-container shadow-xs">
          <MaterialIcon className="text-[24px] text-error shrink-0" name="error" />
          <p className="text-body-md font-medium">{errorMessage}</p>
        </div>
      ) : null}

      {/* 2. FORM TẠO CHƯƠNG TRÌNH MỚI */}
      {showCreateForm ? (
        <form
          className="space-y-6 rounded-2xl border-2 border-primary bg-surface-container-lowest p-6 sm:p-8 shadow-lg"
          onSubmit={handleCreatePoll}
        >
          <div className="border-b border-outline-variant pb-4">
            <h2 className="text-title-lg font-black text-[#173A67]">
              Thiết Lập Chương Trình Bình Chọn Mới
            </h2>
            <p className="text-body-sm text-on-surface-variant">
              Điền thông tin chương trình, cấu hình loại vote, giải thưởng và thêm danh sách tác phẩm.
            </p>
          </div>

          {/* Basic info */}
          <div className="space-y-4">
            <div>
              <label className="text-label-md font-bold text-[#173A67]" htmlFor="p-title">
                Tên chương trình bình chọn <span className="text-error">*</span>
              </label>
              <input
                id="p-title"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-body-md text-on-surface focus:border-primary"
                placeholder="VD: Bình chọn Cuộc thi cắm hoa chào mừng ngày 20-10"
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="text-label-md font-bold text-[#173A67]" htmlFor="p-desc">
                Mô tả chi tiết chương trình
              </label>
              <textarea
                id="p-desc"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 text-body-md text-on-surface focus:border-primary"
                placeholder="Lời dẫn, thể lệ tham gia..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Settings grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 border-t border-outline-variant/60 pt-4">
            {/* Poll type */}
            <div>
              <label className="text-label-md font-bold text-[#173A67]" htmlFor="p-type">Loại bình chọn</label>
              <select
                id="p-type"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-body-md text-on-surface"
                value={pollType}
                onChange={(e) => setPollType(e.target.value as any)}
              >
                <option value="vote">Bình chọn kết quả / Vote tác phẩm</option>
                <option value="quiz">Trả lời câu hỏi trắc nghiệm</option>
              </select>
            </div>

            {/* Access type */}
            <div>
              <label className="text-label-md font-bold text-[#173A67]" htmlFor="p-access">Đối tượng bình chọn</label>
              <select
                id="p-access"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-body-md text-on-surface"
                value={accessType}
                onChange={(e) => setAccessType(e.target.value as any)}
              >
                <option value="free">Công khai / Free (Có link là vote được, giới hạn IP)</option>
                <option value="members_only">Dành riêng cho đoàn viên đã đăng nhập</option>
              </select>
            </div>

            {/* Content type */}
            <div>
              <label className="text-label-md font-bold text-[#173A67]" htmlFor="p-content">Hình thức hiển thị</label>
              <select
                id="p-content"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-body-md text-on-surface"
                value={contentType}
                onChange={(e) => setContentType(e.target.value as any)}
              >
                <option value="image">Vote theo hình ảnh (chọn ảnh zoom)</option>
                <option value="text">Vote theo văn bản thuần</option>
              </select>
            </div>
          </div>

          {/* Rules: Max votes & Points */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 border-t border-outline-variant/60 pt-4">
            <div>
              <label className="text-label-md font-bold text-[#173A67]" htmlFor="p-max">
                Số tác phẩm mỗi người được vote tối đa:
              </label>
              <input
                id="p-max"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 text-headline-sm font-bold text-[#173A67]"
                min={1}
                type="number"
                value={maxVotesPerUser}
                onChange={(e) => setMaxVotesPerUser(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="text-label-md font-bold text-[#173A67]" htmlFor="p-voter-points">
                Điểm thưởng thi đua tặng mỗi người khi vote:
              </label>
              <input
                id="p-voter-points"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 text-headline-sm font-bold text-primary"
                min={0}
                type="number"
                value={voterRewardPoints}
                onChange={(e) => setVoterRewardPoints(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Prediction settings */}
          <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/50 p-4">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
              <input
                checked={hasPrediction}
                className="h-5 w-5 rounded border-amber-400 text-amber-600"
                type="checkbox"
                onChange={(e) => setHasPrediction(e.target.checked)}
              />
              <span>Bật tính năng &ldquo;Tìm người dự đoán đúng nhất&rdquo;</span>
            </label>

            {hasPrediction ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
                <div className="sm:col-span-2">
                  <label className="text-label-sm font-bold text-amber-900" htmlFor="p-pred-q">Câu hỏi dự đoán:</label>
                  <input
                    id="p-pred-q"
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-on-surface"
                    type="text"
                    value={predictionQuestion}
                    onChange={(e) => setPredictionQuestion(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-label-sm font-bold text-amber-900" htmlFor="p-pred-pts">Điểm thưởng người đoán đúng:</label>
                  <input
                    id="p-pred-pts"
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-900"
                    type="number"
                    value={predictorRewardPoints}
                    onChange={(e) => setPredictorRewardPoints(Number(e.target.value))}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Union Member Contest settings */}
          <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-[#173A67]">
              <input
                checked={isUnionContest}
                className="h-5 w-5 rounded border-primary text-primary"
                type="checkbox"
                onChange={(e) => setIsUnionContest(e.target.checked)}
              />
              <span>Đây là cuộc thi của đoàn viên (Tự động cộng điểm cho đội đạt giải khi kết thúc)</span>
            </label>

            {isUnionContest ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 pt-2">
                <div>
                  <label className="text-label-xs font-bold text-[#173A67]" htmlFor="p-first">Giải Nhất (điểm)</label>
                  <input
                    id="p-first"
                    className="mt-1 w-full rounded-lg border border-outline-variant bg-white px-3 py-1.5 font-black text-amber-600"
                    type="number"
                    value={firstPrizePoints}
                    onChange={(e) => setFirstPrizePoints(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-label-xs font-bold text-[#173A67]" htmlFor="p-second">Giải Nhì (điểm)</label>
                  <input
                    id="p-second"
                    className="mt-1 w-full rounded-lg border border-outline-variant bg-white px-3 py-1.5 font-bold text-slate-700"
                    type="number"
                    value={secondPrizePoints}
                    onChange={(e) => setSecondPrizePoints(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-label-xs font-bold text-[#173A67]" htmlFor="p-third">Giải Ba (điểm)</label>
                  <input
                    id="p-third"
                    className="mt-1 w-full rounded-lg border border-outline-variant bg-white px-3 py-1.5 font-bold text-amber-800"
                    type="number"
                    value={thirdPrizePoints}
                    onChange={(e) => setThirdPrizePoints(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-label-xs font-bold text-[#173A67]" htmlFor="p-conso">Khuyến khích (điểm)</label>
                  <input
                    id="p-conso"
                    className="mt-1 w-full rounded-lg border border-outline-variant bg-white px-3 py-1.5 font-bold text-primary"
                    type="number"
                    value={consolationPrizePoints}
                    onChange={(e) => setConsolationPrizePoints(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-label-xs font-bold text-[#173A67]" htmlFor="p-conso-cnt">Số giải Khuyến khích</label>
                  <input
                    id="p-conso-cnt"
                    className="mt-1 w-full rounded-lg border border-outline-variant bg-white px-3 py-1.5 font-bold text-on-surface"
                    type="number"
                    value={consolationPrizeCount}
                    onChange={(e) => setConsolationPrizeCount(Number(e.target.value))}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Options & Member roster setup */}
          <div className="space-y-4 border-t border-outline-variant/60 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-title-md font-extrabold text-[#173A67]">
                Danh Sách Tác Phẩm / Lựa Chọn ({options.length})
              </h3>
              <button
                className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-dusty-dark transition cursor-pointer"
                type="button"
                onClick={handleAddOption}
              >
                <MaterialIcon className="text-[16px]" name="add" />
                <span>Thêm tác phẩm</span>
              </button>
            </div>

            <div className="space-y-6">
              {options.map((opt, optIdx) => (
                <div
                  key={optIdx}
                  className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-bold text-white text-xs">
                      #{optIdx + 1}
                    </span>
                    <button
                      className="text-error text-xs font-bold hover:underline cursor-pointer"
                      type="button"
                      onClick={() => handleRemoveOption(optIdx)}
                    >
                      Xóa tác phẩm ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-label-xs font-bold text-[#173A67]" htmlFor={`opt-title-${optIdx}`}>Tên tác phẩm / phương án:</label>
                      <input
                        id={`opt-title-${optIdx}`}
                        className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm font-semibold"
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
                      <label className="text-label-xs font-bold text-[#173A67]" htmlFor={`opt-desc-${optIdx}`}>Mô tả tác phẩm:</label>
                      <input
                        id={`opt-desc-${optIdx}`}
                        className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm"
                        placeholder="Ý nghĩa, hoa sử dụng..."
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

                  {/* Photo upload with auto-resize */}
                  {contentType === "image" ? (
                    <div className="space-y-2 border-t border-outline-variant/60 pt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-label-xs font-bold text-[#173A67]" htmlFor={`opt-photos-${optIdx}`}>
                          Ảnh tác phẩm (tối đa 3 ảnh, tự động nén tối ưu web):
                        </label>
                        <span className="text-label-xs text-on-surface-variant">
                          {opt.imageUrls.length}/3 ảnh
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {opt.imageUrls.map((url, imgIdx) => (
                          <div
                            key={imgIdx}
                            className="relative h-20 w-20 overflow-hidden rounded-xl border border-outline-variant bg-white shadow-2xs"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt="" className="h-full w-full object-cover" src={url} />
                            <button
                              className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white text-[12px] hover:bg-black"
                              type="button"
                              onClick={() => handleRemoveImage(optIdx, imgIdx)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        {opt.imageUrls.length < 3 ? (
                          <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-white hover:bg-primary/5 transition">
                            <MaterialIcon className="text-primary text-[22px]" name="add_photo_alternate" />
                            <span className="text-[11px] font-bold text-primary mt-0.5">Thêm ảnh</span>
                            <input
                              accept="image/*"
                              className="hidden"
                              id={`opt-photos-${optIdx}`}
                              multiple
                              type="file"
                              onChange={(e) => handleImageUpload(optIdx, e.target.files)}
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {/* Team Members List */}
                  {isUnionContest ? (
                    <div className="space-y-2 border-t border-outline-variant/60 pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-label-xs font-bold text-[#173A67]">
                          Danh sách đoàn viên thực hiện tác phẩm này (nhóm/cá nhân):
                        </p>
                        <button
                          className="text-primary text-xs font-bold hover:underline"
                          type="button"
                          onClick={() => handleAddMember(optIdx)}
                        >
                          + Thêm đoàn viên
                        </button>
                      </div>

                      <div className="space-y-2">
                        {opt.members.map((mem, memIdx) => (
                          <div key={memIdx} className="flex items-center gap-3">
                            <input
                              className="flex-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs text-on-surface"
                              placeholder="Họ và tên đoàn viên"
                              type="text"
                              value={mem.fullName}
                              onChange={(e) => {
                                const next = [...options];
                                next[optIdx].members[memIdx].fullName = e.target.value;
                                setOptions(next);
                              }}
                            />
                            <input
                              className="w-36 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs text-on-surface"
                              placeholder="Mã NV (nếu có)"
                              type="text"
                              value={mem.employeeCode}
                              onChange={(e) => {
                                const next = [...options];
                                next[optIdx].members[memIdx].employeeCode = e.target.value;
                                setOptions(next);
                              }}
                            />
                            {opt.members.length > 1 ? (
                              <button
                                className="text-error text-xs hover:underline"
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
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 border-t border-outline-variant pt-6">
            <button
              className="rounded-xl border border-outline-variant px-5 py-2.5 font-semibold text-on-surface-variant hover:bg-surface-container-high transition cursor-pointer"
              type="button"
              onClick={() => setShowCreateForm(false)}
            >
              Hủy bỏ
            </button>
            <button
              className="rounded-xl bg-primary px-8 py-2.5 font-bold text-white shadow-md hover:bg-dusty-dark transition cursor-pointer disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Đang tạo..." : "Xác nhận tạo chương trình"}
            </button>
          </div>
        </form>
      ) : null}

      {/* 3. BẢNG DANH SÁCH CÁC CHƯƠNG TRÌNH HIỆN CÓ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-title-lg font-bold text-[#173A67]">
            Các Chương Trình Bình Chọn ({polls.length})
          </h2>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xs">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#D9F2EC] text-[#173A67]">
              <tr>
                <th className="px-4 py-3 font-bold">Tên chương trình</th>
                <th className="px-4 py-3 font-bold">Hình thức</th>
                <th className="px-4 py-3 font-bold">Đối tượng</th>
                <th className="px-4 py-3 font-bold">Trạng thái</th>
                <th className="px-4 py-3 font-bold">Ngày tạo</th>
                <th className="px-4 py-3 font-bold text-right">Thao tác Admin</th>
              </tr>
            </thead>
            <tbody>
              {polls.map((p) => {
                const isOpen = p.status === "open";
                const isBusy = busyPollId === p.id;

                return (
                  <tr key={p.id} className="border-t border-outline-variant hover:bg-surface-container-low/50">
                    <td className="px-4 py-3.5 font-bold text-[#173A67] max-w-sm">
                      <Link className="hover:underline line-clamp-2" href={`/polls/${p.id}`}>
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-on-surface-variant">
                      {p.pollType === "vote" ? "Vote tác phẩm" : "Trắc nghiệm"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                        {p.accessType === "free" ? "Free (IP check)" : "Đoàn viên"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isOpen
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-emerald-600" : "bg-slate-500"}`} />
                        {isOpen ? "Đang mở" : "Đã kết thúc"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-on-surface-variant">
                      {new Date(p.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                      <Link
                        className="rounded-lg border border-outline-variant px-2.5 py-1 text-xs font-semibold text-[#173A67] hover:bg-surface-container-high transition"
                        href={`/polls/${p.id}`}
                      >
                        Xem trang
                      </Link>

                      {isOpen ? (
                        <button
                          className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600 transition shadow-xs cursor-pointer disabled:opacity-50"
                          disabled={isBusy}
                          type="button"
                          onClick={() => handleClosePoll(p.id, p.title)}
                        >
                          {isBusy ? "Đang tính..." : "Đóng & Trao giải"}
                        </button>
                      ) : (
                        <button
                          className="rounded-lg border border-primary px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10 transition cursor-pointer disabled:opacity-50"
                          disabled={isBusy}
                          type="button"
                          onClick={() => handleReopenPoll(p.id)}
                        >
                          {isBusy ? "Đang mở..." : "Mở lại"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
