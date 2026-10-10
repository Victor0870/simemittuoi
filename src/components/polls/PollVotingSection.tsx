"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollDetail, PollOption } from "@/lib/data/polls";
import { useAuth } from "@/components/auth/AuthProvider";
import { ImageLightboxModal } from "@/components/polls/ImageLightboxModal";

type Props = {
  poll: PollDetail;
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

export function PollVotingSection({ poll }: Props) {
  const router = useRouter();
  const { user, isGuest } = useAuth();

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [predictedCount, setPredictedCount] = useState<string>("");
  const [predictorName, setPredictorName] = useState<string>("");
  const [predictorContact, setPredictorContact] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lightbox zoom image state
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  const maxVotes = poll.maxVotesPerUser || 3;
  const isClosed = poll.status === "closed";
  const isInactive = poll.isActive === false;

  function handleToggleOption(optionId: string) {
    if (isClosed || isInactive) return;

    if (selectedOptionIds.includes(optionId)) {
      setSelectedOptionIds(selectedOptionIds.filter((id) => id !== optionId));
      return;
    }

    if (selectedOptionIds.length >= maxVotes) {
      alert(`Bạn chỉ được chọn tối đa ${maxVotes} tác phẩm.`);
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

    if (selectedOptionIds.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất 1 tác phẩm để bình chọn.");
      return;
    }

    if (poll.accessType === "members_only" && isGuest) {
      setErrorMessage("Chương trình này yêu cầu đăng nhập tài khoản đoàn viên để bình chọn.");
      return;
    }

    if (poll.hasPrediction) {
      if (!predictedCount || isNaN(parseInt(predictedCount, 10))) {
        setErrorMessage("Vui lòng nhập số người dự đoán cho tác phẩm đạt giải nhất.");
        return;
      }
      if (isGuest && (!predictorName.trim() || !predictorContact.trim())) {
        setErrorMessage("Vui lòng nhập họ tên và thông tin liên hệ để nhận thưởng khi dự đoán đúng.");
        return;
      }
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
          predictorName: predictorName.trim(),
          predictorContact: predictorContact.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gửi bình chọn thất bại.");
      }

      setSuccessMessage(data.message || "Bình chọn thành công! Cảm ơn bạn.");
      setSelectedOptionIds([]);
      setPredictedCount("");
      setPredictorName("");
      setPredictorContact("");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Đã xảy ra lỗi khi gửi bình chọn.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Lightbox Modal */}
      <ImageLightboxModal
        imageUrl={zoomedImage?.url || null}
        title={zoomedImage?.title}
        onClose={() => setZoomedImage(null)}
      />

      {/* Title & Instructions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h3 className="text-headline-sm font-extrabold text-[#173A67]">
            Danh Sách Tác Phẩm Bình Chọn
          </h3>
          <p className="text-body-sm text-on-surface-variant">
            {isInactive
              ? "Chương trình hiện đang tạm ngưng (Inactive)."
              : isClosed
              ? "Chương trình bình chọn đã kết thúc."
              : `Chọn tối đa ${maxVotes} tác phẩm bạn yêu thích nhất (Đã chọn: ${selectedOptionIds.length}/${maxVotes})`}
          </p>
        </div>

        {!isClosed && !isInactive ? (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3.5 py-1.5 text-label-md font-bold text-amber-900 border border-amber-300">
            <MaterialIcon className="text-[18px] text-amber-600" name="how_to_vote" />
            <span>Được chọn tối đa {maxVotes} tác phẩm</span>
          </div>
        ) : null}
      </div>

      {/* Success banner */}
      {successMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900 shadow-xs">
          <MaterialIcon className="text-[28px] text-emerald-600 shrink-0" name="check_circle" />
          <div>
            <p className="text-title-sm font-bold">Thành công!</p>
            <p className="text-body-md">{successMessage}</p>
          </div>
        </div>
      ) : null}

      {/* Error banner */}
      {errorMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-error/40 bg-error-container/40 p-4 text-on-error-container shadow-xs">
          <MaterialIcon className="text-[24px] text-error shrink-0" name="error" />
          <p className="text-body-md font-medium">{errorMessage}</p>
        </div>
      ) : null}

      {/* Options List / Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {poll.options.map((opt) => {
          const isSelected = selectedOptionIds.includes(opt.id);

          return (
            <div
              key={opt.id}
              className={`relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                  : "border-outline-variant bg-surface-container-lowest hover:border-outline hover:shadow-xs"
              }`}
            >
              {/* Photo Gallery (up to 3 photos) */}
              {poll.contentType === "image" && opt.imageUrls.length > 0 ? (
                <div className="space-y-1.5 p-2.5 sm:p-3 pb-0">
                  {/* Main large image */}
                  <div
                    className="group relative h-44 sm:h-56 w-full overflow-hidden rounded-xl bg-surface-container cursor-pointer"
                    onClick={() =>
                      setZoomedImage({ url: opt.imageUrls[0], title: opt.title })
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={opt.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      src={opt.imageUrls[0]}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs sm:text-label-sm font-bold text-white backdrop-blur-xs">
                        <MaterialIcon className="text-[16px] sm:text-[18px]" name="zoom_in" />
                        Xem phóng to
                      </span>
                    </div>
                  </div>

                  {/* 2 extra thumbnail images if available */}
                  {opt.imageUrls.length > 1 ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {opt.imageUrls.slice(1, 3).map((img, i) => (
                        <div
                          key={i}
                          className="group relative h-20 sm:h-24 overflow-hidden rounded-lg bg-surface-container cursor-pointer"
                          onClick={() =>
                            setZoomedImage({
                              url: img,
                              title: `${opt.title} (Ảnh ${i + 2})`,
                            })
                          }
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt=""
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            src={img}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MaterialIcon className="text-white text-[18px] sm:text-[20px]" name="zoom_in" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Card Body */}
              <div className="flex flex-1 flex-col p-3.5 sm:p-5">
                <div className="mb-2 flex items-start justify-between gap-2.5">
                  <h4 className="text-base sm:text-title-md font-extrabold text-[#173A67] leading-snug">
                    {opt.title}
                  </h4>
                  <span className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[11px] sm:text-xs font-bold text-on-surface-variant">
                    #{opt.orderNum}
                  </span>
                </div>

                {opt.description ? (
                  <p className="text-body-sm text-on-surface-variant line-clamp-3 mb-3">
                    {opt.description}
                  </p>
                ) : null}

                {/* Team members */}
                {poll.isUnionContest && opt.members.length > 0 ? (
                  <div className="mt-auto mb-4 rounded-xl bg-surface-container-low p-2.5">
                    <p className="text-label-xs font-bold text-[#173A67] mb-1">
                      Thành viên tác giả:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {opt.members.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-label-xs font-semibold text-[#173A67] border border-outline-variant/60 shadow-2xs"
                        >
                          <MaterialIcon className="text-[12px] text-primary" name="person" />
                          {m.fullName} {m.employeeCode ? `(${m.employeeCode})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Vote Selection Button */}
                {isInactive ? (
                  <div className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-500 border border-slate-200">
                    <MaterialIcon className="text-[16px]" name="pause_circle" />
                    <span>Tạm ngưng bình chọn</span>
                  </div>
                ) : !isClosed ? (
                  <button
                    className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold transition shadow-xs cursor-pointer ${
                      isSelected
                        ? "bg-primary text-white"
                        : "border-2 border-primary text-primary hover:bg-primary/10"
                    }`}
                    type="button"
                    onClick={() => handleToggleOption(opt.id)}
                  >
                    <MaterialIcon
                      name={isSelected ? "check_circle" : "radio_button_unchecked"}
                    />
                    <span>{isSelected ? "Đã chọn tác phẩm này" : "Bình chọn tác phẩm này"}</span>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submission Form (Prediction & Final Action) */}
      {isInactive ? (
        <div className="mt-6 sm:mt-8 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-6 text-center text-amber-950">
          <MaterialIcon className="text-[36px] text-amber-600 mx-auto mb-2" name="visibility_off" />
          <h3 className="text-base sm:text-title-md font-bold">Chương trình bình chọn đang ở trạng thái Inactive (Tạm ẩn)</h3>
          <p className="text-xs sm:text-body-sm text-amber-800 mt-1 max-w-lg mx-auto">
            Hệ thống tạm ngưng nhận bình chọn. Bạn sẽ có thể gửi bình chọn khi Quản trị viên kích hoạt lại chương trình.
          </p>
        </div>
      ) : !isClosed ? (
        <form
          className="mt-6 sm:mt-8 space-y-4 sm:space-y-6 rounded-2xl border-2 border-amber-400 bg-amber-50/40 p-4 sm:p-8 shadow-xs"
          onSubmit={handleSubmitVote}
        >
          <div className="flex items-center gap-2 text-amber-950">
            <MaterialIcon className="text-[22px] sm:text-[26px] text-amber-600 shrink-0" name="how_to_vote" />
            <h3 className="text-base sm:text-title-lg font-black">Xác Nhận & Gửi Phiếu Bình Chọn</h3>
          </div>

          <p className="text-sm sm:text-body-md text-amber-900">
            Bạn đang chọn <strong>{selectedOptionIds.length}</strong> / {maxVotes} tác phẩm.
          </p>

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
                  Số phiếu dự đoán cho tác phẩm đạt Giải Nhất:
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

              {/* Guest identification for contact/prize */}
              {isGuest ? (
                <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                  <div>
                    <label className="text-label-sm font-bold text-[#173A67]" htmlFor="pred-name">
                      Họ và tên của bạn:
                    </label>
                    <input
                      id="pred-name"
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-body-md text-on-surface"
                      placeholder="Nguyễn Văn A..."
                      required
                      type="text"
                      value={predictorName}
                      onChange={(e) => setPredictorName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-label-sm font-bold text-[#173A67]" htmlFor="pred-contact">
                      Số điện thoại hoặc Email:
                    </label>
                    <input
                      id="pred-contact"
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-body-md text-on-surface"
                      placeholder="0912... hoặc a@gmail.com"
                      required
                      type="text"
                      value={predictorContact}
                      onChange={(e) => setPredictorContact(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Submit Button */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <p className="text-label-sm text-on-surface-variant">
              Mỗi thiết bị chỉ được gửi 1 lần mỗi 30 phút để chống spam.
            </p>

            <button
              className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-title-sm font-extrabold text-white shadow-md hover:bg-dusty-dark transition cursor-pointer disabled:opacity-50"
              disabled={submitting || selectedOptionIds.length === 0}
              type="submit"
            >
              <MaterialIcon className="text-[22px]" name="send" />
              <span>{submitting ? "Đang gửi bình chọn..." : "Gửi phiếu bình chọn"}</span>
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
