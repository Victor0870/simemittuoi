"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { PollDetail } from "@/lib/data/polls";
import { PollEditorModal } from "@/components/polls/PollEditorModal";
import { PollPointGrantsModal } from "@/components/polls/PollPointGrantsModal";
import { PollQrButton } from "@/components/polls/PollQrButton";
import { usePollPhase } from "@/components/polls/usePollPhase";

type Props = {
  poll: PollDetail;
};

export function PollAdminToolbar({ poll }: Props) {
  const router = useRouter();
  const { can, loading } = useAuth();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isGrantsOpen, setIsGrantsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(poll.isActive);

  const [mountedAt] = useState(() => Date.now());
  const phase = usePollPhase(poll, mountedAt);

  useEffect(() => {
    setIsActive(poll.isActive);
  }, [poll.isActive]);

  if (loading || !can(PERMISSIONS.pollsManage)) {
    return null;
  }

  async function handleSetStatus(status: "open" | "upcoming") {
    const question =
      status === "open"
        ? `Mở bình chọn NGAY cho "${poll.title}"?\n\nTừ lúc này phiếu bình chọn sẽ được ghi nhận thật.`
        : `Chuyển "${poll.title}" về trạng thái SẮP MỞ?\n\nMọi người vẫn xem và bình chọn thử được nhưng phiếu không được ghi nhận. Phiếu thật đã gửi trước đó vẫn giữ nguyên.`;
    if (!window.confirm(question)) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/polls/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Thao tác thất bại");
      setMessage(data.message || "Đã cập nhật trạng thái!");
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "Lỗi khi đổi trạng thái");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleClosePoll() {
    const confirm = window.confirm(
      `Bạn có chắc chắn muốn KẾT THÚC chương trình bình chọn:\n"${poll.title}"?\n\nHệ thống sẽ:\n1. Chốt kết quả bình chọn (Hạng 1, 2, 3 và Khuyến khích)\n2. Tìm người dự đoán gần đúng nhất\n3. Tự động cộng điểm thi đua cho các đoàn viên trong các nhóm đạt giải!`,
    );
    if (!confirm) return;

    setIsBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/polls/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thao tác thất bại");
      setMessage(data.message || "Đã đóng bình chọn và trao giải thành công!");
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "Lỗi khi đóng bình chọn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReopenPoll() {
    setIsBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/polls/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, status: "open" }),
      });
      if (!res.ok) throw new Error("Thao tác thất bại");
      setMessage("Đã mở lại chương trình bình chọn!");
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "Lỗi khi mở lại");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleActive() {
    setIsBusy(true);
    setMessage(null);
    const nextActive = !isActive;
    setIsActive(nextActive); // Optimistic UI update
    try {
      const res = await fetch("/api/polls/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIsActive(!nextActive); // Revert on error
        throw new Error(data.error || "Thao tác thất bại");
      }
      setMessage(
        nextActive
          ? "Đã kích hoạt (Active) chương trình! Người dùng có thể nhìn thấy và bình chọn."
          : "Đã chuyển sang Inactive (Tạm ẩn)! Người dùng thông thường sẽ không nhìn thấy chương trình."
      );
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "Lỗi khi đổi trạng thái kích hoạt");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border-2 border-[#173A67] bg-linear-to-r from-[#173A67] to-[#27496D] p-3 sm:p-4 text-white shadow-md space-y-2.5 sm:space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-900 font-bold">
              <MaterialIcon className="text-[18px] sm:text-[20px]" name="shield_person" />
            </span>
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold text-amber-300">
                Chế độ Quản Trị Viên
              </p>
              <p className="text-xs sm:text-sm font-semibold text-white/90 line-clamp-1 sm:line-clamp-none">
                Cấu hình, tải ảnh lên, nhập thành viên và chốt giải cuộc thi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            {/* BUTTON TOGGLE ACTIVE / INACTIVE */}
            <button
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50 ${
                isActive
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-slate-300 hover:bg-slate-200 text-slate-900"
              }`}
              disabled={isBusy}
              title={
                isActive
                  ? "Đang Active (Hiện). Bấm để chuyển sang Inactive (Tạm ẩn)"
                  : "Đang Inactive (Tạm ẩn). Bấm để chuyển sang Active (Kích hoạt)"
              }
              type="button"
              onClick={handleToggleActive}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isActive ? "bg-white animate-pulse" : "bg-slate-600"
                }`}
              />
              <span>{isActive ? "Active" : "Inactive"}</span>
            </button>

            {poll.hasJudges ? (
              <PollQrButton
                pollId={poll.id}
                pollTitle={poll.title}
                label="QR giám khảo"
                heading="Mã QR riêng cho Ban giám khảo"
                description="Chỉ gửi link này cho giám khảo chưa có tài khoản. Link công khai không nhận phiếu của họ, nên người khác không nhập mã giám khảo để đè kết quả."
                downloadName={`qr-giam-khao-${poll.id}.png`}
                buttonClassName="flex items-center justify-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#173A67] shadow-xs hover:bg-amber-100 transition cursor-pointer sm:px-3.5 sm:py-2 sm:text-xs"
                loadUrl={async () => {
                  const res = await fetch(`/api/polls/judge-link?pollId=${encodeURIComponent(poll.id)}`);
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok || !data.token) {
                    throw new Error(data.error || "Không tạo được link giám khảo.");
                  }
                  return `${window.location.origin}/polls/${poll.id}?gk=${encodeURIComponent(data.token)}#binh-chon`;
                }}
              />
            ) : null}

            {poll.voteMode === "points" ? (
              <button
                className="flex items-center justify-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#173A67] shadow-xs hover:bg-amber-100 transition cursor-pointer sm:px-3.5 sm:py-2 sm:text-xs"
                type="button"
                onClick={() => setIsGrantsOpen(true)}
              >
                <MaterialIcon className="text-[15px] sm:text-[16px]" name="add_circle" />
                <span>Cộng điểm</span>
              </button>
            ) : null}

            {/* BUTTON CÀI ĐẶT & CHỈNH SỬA CUỘC THI */}
            <button
              className="flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-xl bg-amber-400 px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-black text-slate-900 shadow-xs hover:bg-amber-300 transition cursor-pointer"
              type="button"
              onClick={() => setIsEditorOpen(true)}
            >
              <MaterialIcon className="text-[16px] sm:text-[18px]" name="tune" />
              <span>⚙️ Cài đặt cuộc thi</span>
              <span className="hidden md:inline">(Up ảnh, thành viên)</span>
            </button>

            {phase === "upcoming" ? (
              <button
                className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white shadow-xs hover:bg-emerald-600 transition cursor-pointer disabled:opacity-50"
                disabled={isBusy}
                type="button"
                onClick={() => handleSetStatus("open")}
              >
                <MaterialIcon className="text-[15px] sm:text-[16px]" name="play_circle" />
                <span>Mở bình chọn ngay</span>
              </button>
            ) : phase === "open" ? (
              <button
                className="flex items-center justify-center gap-1 rounded-xl bg-sky-500 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white shadow-xs hover:bg-sky-600 transition cursor-pointer disabled:opacity-50"
                disabled={isBusy}
                title="Cho mọi người xem trước và bình chọn thử, chưa ghi nhận phiếu"
                type="button"
                onClick={() => handleSetStatus("upcoming")}
              >
                <MaterialIcon className="text-[15px] sm:text-[16px]" name="schedule" />
                <span>Chuyển về Sắp mở</span>
              </button>
            ) : null}

            {phase === "closed" && can(PERMISSIONS.rewardsPayout) ? (
              <Link
                className="flex items-center justify-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#173A67] shadow-xs hover:bg-amber-100 transition sm:px-3.5 sm:py-2 sm:text-xs"
                href={`/office/rewards?poll=${encodeURIComponent(poll.id)}`}
              >
                <MaterialIcon className="text-[15px] sm:text-[16px]" name="payments" />
                <span>DS nhận thưởng</span>
              </Link>
            ) : null}

            {/* BUTTON ĐÓNG/MỞ LẠI */}
            {phase === "upcoming" ? null : phase !== "closed" ? (
              <button
                className="flex items-center justify-center gap-1 rounded-xl bg-rose-500 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white shadow-xs hover:bg-rose-600 transition cursor-pointer disabled:opacity-50"
                disabled={isBusy}
                type="button"
                onClick={handleClosePoll}
              >
                <MaterialIcon className="text-[15px] sm:text-[16px]" name="emoji_events" />
                <span>{isBusy ? "Đang tính..." : "Đóng & Trao giải"}</span>
              </button>
            ) : (
              <button
                className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white shadow-xs hover:bg-emerald-600 transition cursor-pointer disabled:opacity-50"
                disabled={isBusy}
                type="button"
                onClick={handleReopenPoll}
              >
                <MaterialIcon className="text-[15px] sm:text-[16px]" name="refresh" />
                <span>{isBusy ? "Đang mở..." : "Mở lại"}</span>
              </button>
            )}

            <Link
              className="flex items-center gap-0.5 rounded-xl bg-white/10 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-semibold text-white hover:bg-white/20 transition"
              href="/admin/polls"
            >
              <span>Tất cả</span>
              <MaterialIcon className="text-[13px] sm:text-[14px]" name="arrow_forward" />
            </Link>
          </div>
        </div>

        {!isActive ? (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/25 border border-amber-400/50 px-3 py-2 text-xs font-semibold text-amber-200">
            <MaterialIcon className="text-[18px] text-amber-300 shrink-0" name="visibility_off" />
            <span>
              ⚠️ Lưu ý Quản trị: Chương trình này đang ở trạng thái <strong>INACTIVE (Tạm ẩn)</strong>. Người dùng thông thường và khách không thấy trong danh sách và không thể gửi bình chọn.
            </span>
          </div>
        ) : null}

        {poll.accessType === "free" && poll.guestVoteCount >= poll.maxGuestVotes ? (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/25 border border-rose-400/50 px-3 py-2 text-xs font-semibold text-rose-200">
            <MaterialIcon className="text-[18px] text-rose-300 shrink-0" name="shield" />
            <span>
              🛡️ An toàn: Đã đạt giới hạn <strong>{poll.maxGuestVotes} lượt bình chọn tự do</strong>. Hệ thống đang tự động chặn khách vãng lai và chỉ mở tiếp cho Đoàn viên đăng nhập.
            </span>
          </div>
        ) : null}

        {message ? (
          <div className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-amber-200">
            {message}
          </div>
        ) : null}
      </div>

      {/* Editor Modal */}
      <PollEditorModal
        initialPoll={poll}
        isOpen={isEditorOpen}
        mode="edit"
        onClose={() => setIsEditorOpen(false)}
        onSaved={() => {
          router.refresh();
        }}
      />

      {poll.voteMode === "points" ? (
        <PollPointGrantsModal isOpen={isGrantsOpen} poll={poll} onClose={() => setIsGrantsOpen(false)} />
      ) : null}
    </>
  );
}
