"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";
import type { PollDetail } from "@/lib/data/polls";
import { PollEditorModal } from "@/components/polls/PollEditorModal";

type Props = {
  poll: PollDetail;
};

export function PollAdminToolbar({ poll }: Props) {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Only show if user is admin
  if (loading || profile?.role !== "admin" || profile?.approval_status !== "approved") {
    return null;
  }

  const isOpen = poll.status === "open";

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

  return (
    <>
      <div className="rounded-2xl border-2 border-[#173A67] bg-linear-to-r from-[#173A67] to-[#27496D] p-4 text-white shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-slate-900 font-bold">
              <MaterialIcon className="text-[20px]" name="shield_person" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wider font-extrabold text-amber-300">
                Chế độ Quản Trị Viên
              </p>
              <p className="text-sm font-semibold text-white/90">
                Bạn có toàn quyền cấu hình, up ảnh, nhập thành viên và chốt kết quả cuộc thi này
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* BUTTON CÀI ĐẶT & CHỈNH SỬA CUỘC THI */}
            <button
              className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-900 shadow-xs hover:bg-amber-300 transition cursor-pointer"
              type="button"
              onClick={() => setIsEditorOpen(true)}
            >
              <MaterialIcon className="text-[18px]" name="tune" />
              <span>⚙️ Cài Đặt Cuộc Thi (Up ảnh, sửa tác phẩm, đoàn viên)</span>
            </button>

            {/* BUTTON ĐÓNG/MỞ LẠI */}
            {isOpen ? (
              <button
                className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-600 transition cursor-pointer disabled:opacity-50"
                disabled={isBusy}
                type="button"
                onClick={handleClosePoll}
              >
                <MaterialIcon className="text-[16px]" name="emoji_events" />
                <span>{isBusy ? "Đang xử lý..." : "Đóng & Trao giải"}</span>
              </button>
            ) : (
              <button
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-600 transition cursor-pointer disabled:opacity-50"
                disabled={isBusy}
                type="button"
                onClick={handleReopenPoll}
              >
                <MaterialIcon className="text-[16px]" name="refresh" />
                <span>{isBusy ? "Đang mở..." : "Mở lại bình chọn"}</span>
              </button>
            )}

            <Link
              className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
              href="/admin/polls"
            >
              <span>Tất cả polls</span>
              <MaterialIcon className="text-[14px]" name="arrow_forward" />
            </Link>
          </div>
        </div>

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
    </>
  );
}
