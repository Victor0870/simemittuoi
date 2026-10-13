"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { resizeImageFile } from "@/lib/image-resize";
import type { PollDetail, PollOption } from "@/lib/data/polls";

export type OptionFormState = {
  id?: string;
  title: string;
  description: string;
  imageUrls: string[];
  members: Array<{ fullName: string; employeeCode: string }>;
};

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
  const [maxVotesPerUser, setMaxVotesPerUser] = useState(3);
  const [maxGuestVotes, setMaxGuestVotes] = useState(250);
  const [hasPrediction, setHasPrediction] = useState(true);
  const [predictionQuestion, setPredictionQuestion] = useState(
    "Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?",
  );
  const [voterRewardPoints, setVoterRewardPoints] = useState(10);
  const [predictorRewardPoints, setPredictorRewardPoints] = useState(50);

  // Union Contest points
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

    if (initialPoll && mode === "edit") {
      setTitle(initialPoll.title || "");
      setDescription(initialPoll.description || "");
      setPollType(initialPoll.pollType || "vote");
      setAccessType(initialPoll.accessType || "free");
      setContentType(initialPoll.contentType || "image");
      setIsActive(initialPoll.isActive !== false);
      setMaxVotesPerUser(initialPoll.maxVotesPerUser || 3);
      setMaxGuestVotes(initialPoll.maxGuestVotes ?? 250);
      setHasPrediction(Boolean(initialPoll.hasPrediction));
      setPredictionQuestion(
        initialPoll.predictionQuestion ||
          "Theo bạn có bao nhiêu người bình chọn cho tác phẩm đạt giải nhất?",
      );
      setVoterRewardPoints(initialPoll.voterRewardPoints ?? 10);
      setPredictorRewardPoints(initialPoll.predictorRewardPoints ?? 50);
      setIsUnionContest(Boolean(initialPoll.isUnionContest));
      setFirstPrizePoints(initialPoll.firstPrizePoints ?? 50);
      setSecondPrizePoints(initialPoll.secondPrizePoints ?? 40);
      setThirdPrizePoints(initialPoll.thirdPrizePoints ?? 30);
      setConsolationPrizePoints(initialPoll.consolationPrizePoints ?? 20);
      setConsolationPrizeCount(initialPoll.consolationPrizeCount ?? 2);

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
      setMaxVotesPerUser(3);
      setHasPrediction(true);
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
    if (options.length <= 2) {
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

  // Save changes
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Vui lòng nhập tên chương trình bình chọn.");
      return;
    }

    if (options.length < 2) {
      setError("Cần có ít nhất 2 tác phẩm/lựa chọn.");
      return;
    }

    for (let i = 0; i < options.length; i++) {
      if (!options[i].title.trim()) {
        setError(`Vui lòng nhập tên cho Tác phẩm #${i + 1}`);
        return;
      }
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
        maxVotesPerUser,
        maxGuestVotes,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[96vh] sm:max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl bg-surface-container-lowest shadow-2xl border border-outline-variant overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/70 bg-[#F4F9F8] px-4 py-3 sm:px-6 sm:py-4">
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

        {/* Tab Navigation (Scrollable on mobile) */}
        <div className="flex overflow-x-auto border-b border-outline-variant bg-surface-container-low px-3 sm:px-6 gap-1 sm:gap-2 whitespace-nowrap">
          <button
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "options"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
            type="button"
            onClick={() => setActiveTab("options")}
          >
            <MaterialIcon className="text-[16px] sm:text-[18px]" name="collections" />
            <span>Tác Phẩm & Đoàn Viên ({options.length})</span>
          </button>
          <button
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "general"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
            type="button"
            onClick={() => setActiveTab("general")}
          >
            <MaterialIcon className="text-[16px] sm:text-[18px]" name="tune" />
            <span>Cài Đặt Vote & Thể Lệ</span>
          </button>
          <button
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "prizes"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
            type="button"
            onClick={() => setActiveTab("prizes")}
          >
            <MaterialIcon className="text-[16px] sm:text-[18px]" name="emoji_events" />
            <span>Giải Thưởng & Dự Đoán</span>
          </button>
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
        <form className="flex-1 overflow-y-auto p-6 space-y-6" onSubmit={handleSubmit}>
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
                          placeholder="VD: Hương Sắc Tháng 10"
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
                          Mô tả / Ý nghĩa tác phẩm:
                        </label>
                        <input
                          id={`modal-opt-desc-${optIdx}`}
                          className="mt-1 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface focus:border-primary"
                          placeholder="Ý nghĩa, các loại hoa, chủ đề..."
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
                              <input
                                className="flex-1 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-1.5 text-xs text-on-surface placeholder:text-outline focus:border-primary"
                                placeholder="Họ và tên đoàn viên (VD: Nguyễn Thị Lan)"
                                type="text"
                                value={mem.fullName}
                                onChange={(e) => {
                                  const next = [...options];
                                  next[optIdx].members[memIdx].fullName = e.target.value;
                                  setOptions(next);
                                }}
                              />
                              <input
                                className="w-36 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-1.5 text-xs text-on-surface placeholder:text-outline focus:border-primary"
                                placeholder="Mã NV (VD: NV012)"
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
                    placeholder="VD: Bình chọn Cuộc thi cắm hoa chào mừng ngày Phụ nữ Việt Nam 20-10"
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

              {/* Voting limit */}
              <div className="rounded-2xl border border-outline-variant bg-white p-5 space-y-4">
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

                <div className="flex items-center justify-between border-t border-outline-variant/60 pt-4">
                  <div>
                    <h4 className="text-sm font-bold text-[#173A67]">
                      Điểm thi đua tặng cho người tham gia bình chọn
                    </h4>
                    <p className="text-xs text-on-surface-variant">
                      Cộng điểm trực tiếp vào tài khoản đoàn viên khi bấm gửi bình chọn
                    </p>
                  </div>
                  <input
                    className="w-24 rounded-xl border border-outline-variant bg-white px-3 py-2 text-center text-title-md font-bold text-amber-600"
                    min={0}
                    type="number"
                    value={voterRewardPoints}
                    onChange={(e) => setVoterRewardPoints(Number(e.target.value))}
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
