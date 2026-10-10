"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollDetail, PollSummary } from "@/lib/data/polls";
import { PollEditorModal } from "@/components/polls/PollEditorModal";

type Props = {
  polls: PollSummary[];
  currentAdminName: string;
};

export function AdminPollsManager({ polls, currentAdminName }: Props) {
  const router = useRouter();
  const [pollList, setPollList] = useState<PollSummary[]>(polls);

  useEffect(() => {
    setPollList(polls);
  }, [polls]);

  // Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingPollDetail, setEditingPollDetail] = useState<PollDetail | null>(null);
  const [loadingPollId, setLoadingPollId] = useState<string | null>(null);

  // Status
  const [busyPollId, setBusyPollId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Open Create Modal
  function handleOpenCreate() {
    setEditingPollDetail(null);
    setModalMode("create");
    setIsEditorOpen(true);
  }

  // Open Edit Modal for a specific poll
  async function handleOpenEdit(pollId: string) {
    setLoadingPollId(pollId);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/polls/${pollId}`);
      if (!res.ok) throw new Error("Không thể tải thông tin cuộc thi.");
      const detail: PollDetail = await res.json();
      setEditingPollDetail(detail);
      setModalMode("edit");
      setIsEditorOpen(true);
    } catch (err: any) {
      setErrorMessage(err?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoadingPollId(null);
    }
  }

  // Close poll & Award
  async function handleClosePoll(pollId: string, title: string) {
    const confirm = window.confirm(
      `Bạn có chắc chắn muốn KẾT THÚC chương trình bình chọn:\n"${title}"?\n\nHệ thống sẽ:\n1. Chốt kết quả bình chọn (Hạng 1, 2, 3 và Khuyến khích)\n2. Tìm người dự đoán gần đúng nhất\n3. Tự động cộng điểm thi đua cho các đoàn viên trong các nhóm đạt giải!`,
    );
    if (!confirm) return;

    setBusyPollId(pollId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/polls/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể kết thúc bình chọn");

      setSuccessMessage(data.message || "Đã đóng bình chọn và trao giải thành công!");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Lỗi khi kết thúc chương trình.");
    } finally {
      setBusyPollId(null);
    }
  }

  // Toggle reopen
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

  // Toggle Active / Inactive
  async function handleToggleActive(pollId: string, currentActive: boolean) {
    setBusyPollId(pollId);
    setSuccessMessage(null);
    setErrorMessage(null);
    const nextActive = !currentActive;
    // Optimistic UI update
    setPollList((prev) =>
      prev.map((p) => (p.id === pollId ? { ...p, isActive: nextActive } : p))
    );
    try {
      const res = await fetch("/api/polls/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Revert on error
        setPollList((prev) =>
          prev.map((p) => (p.id === pollId ? { ...p, isActive: currentActive } : p))
        );
        throw new Error(data.error || "Thao tác thất bại");
      }
      setSuccessMessage(
        nextActive
          ? "Đã kích hoạt (Active) chương trình! Người dùng có thể nhìn thấy và bình chọn."
          : "Đã chuyển sang Inactive (Tạm ẩn)! Người dùng thông thường sẽ không nhìn thấy chương trình."
      );
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Lỗi khi cập nhật trạng thái kích hoạt.");
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
            Cài đặt thể lệ, quản lý số lượng tác phẩm, tải ảnh lên, cập nhật danh sách đoàn viên và đóng/mở trao giải.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-amber-600 transition cursor-pointer"
            type="button"
            onClick={handleOpenCreate}
          >
            <MaterialIcon name="add_circle" />
            <span>+ Tạo chương trình mới</span>
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

      {/* Quick Guide Card */}
      <div className="rounded-2xl border border-[#27496D]/20 bg-linear-to-r from-[#F4F9F8] to-[#E5F4F0] p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173A67] text-white">
            <MaterialIcon className="text-[22px]" name="lightbulb" />
          </span>
          <div className="space-y-1 text-sm text-[#173A67]">
            <p className="font-bold text-base">Hướng dẫn quản lý & cài đặt bình chọn:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-xs text-[#27496D]">
              <li>
                Bấm <strong>&ldquo;⚙️ Cài đặt / Sửa&rdquo;</strong> ở mỗi chương trình để: Thêm/bớt tác phẩm, up ảnh chụp máy ảnh (hệ thống tự động nén tối ưu), nhập danh sách đoàn viên cho từng nhóm.
              </li>
              <li>
                Bấm <strong>&ldquo;+ Tạo chương trình mới&rdquo;</strong> để tạo cuộc thi vote hoặc câu hỏi trắc nghiệm mới.
              </li>
              <li>
                Khi chương trình kết thúc, bấm <strong>&ldquo;Đóng & Trao giải&rdquo;</strong>: Hệ thống sẽ tự động tìm người dự đoán đúng nhất và cộng điểm thi đua vào tài khoản của đoàn viên đạt giải!
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. BẢNG DANH SÁCH CÁC CHƯƠNG TRÌNH */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-title-lg font-bold text-[#173A67]">
            Các Chương Trình Bình Chọn ({pollList.length})
          </h2>
          <span className="text-xs text-on-surface-variant font-medium">
            Đăng nhập bởi: <strong>{currentAdminName}</strong>
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xs">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#D9F2EC] text-[#173A67]">
              <tr>
                <th className="px-4 py-3 font-bold">Tên chương trình</th>
                <th className="px-4 py-3 font-bold">Hình thức</th>
                <th className="px-4 py-3 font-bold">Đối tượng</th>
                <th className="px-4 py-3 font-bold">Hiển thị (Active)</th>
                <th className="px-4 py-3 font-bold">Tiến trình</th>
                <th className="px-4 py-3 font-bold">Ngày tạo</th>
                <th className="px-4 py-3 font-bold text-right">Thao tác Quản trị</th>
              </tr>
            </thead>
            <tbody>
              {pollList.map((p) => {
                const isOpen = p.status === "open";
                const isBusy = busyPollId === p.id;
                const isLoadingEdit = loadingPollId === p.id;

                return (
                  <tr key={p.id} className="border-t border-outline-variant hover:bg-surface-container-low/50">
                    <td className="px-4 py-3.5 font-bold text-[#173A67] max-w-sm">
                      <div className="flex items-center gap-2">
                        <Link className="hover:underline line-clamp-2" href={`/polls/${p.id}`}>
                          {p.title}
                        </Link>
                        {!p.isActive ? (
                          <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                            Ẩn
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-on-surface-variant">
                      {p.pollType === "vote" ? "Vote tác phẩm" : "Trắc nghiệm"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                          {p.accessType === "free" ? "Free (IP check)" : "Đoàn viên"}
                        </span>
                        {p.accessType === "free" ? (
                          <div className="text-[11px] font-medium text-amber-900">
                            🛡️ {p.guestVoteCount}/{p.maxGuestVotes} lượt
                          </div>
                        ) : null}
                      </div>
                    </td>
                    {/* CỘT KÍCH HOẠT (ACTIVE / INACTIVE) */}
                    <td className="px-4 py-3.5">
                      <button
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition cursor-pointer shadow-2xs border ${
                          p.isActive
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                        } disabled:opacity-50`}
                        disabled={isBusy}
                        title={
                          p.isActive
                            ? "Đang Active (Hiện). Bấm để chuyển sang Inactive (Tạm ẩn)"
                            : "Đang Inactive (Tạm ẩn). Bấm để chuyển sang Active (Kích hoạt)"
                        }
                        type="button"
                        onClick={() => handleToggleActive(p.id, p.isActive)}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            p.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                          }`}
                        />
                        <span>{p.isActive ? "Active" : "Inactive"}</span>
                      </button>
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
                      {/* BUTTON CÀI ĐẶT & SỬA */}
                      <button
                        className="inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-3 py-1 text-xs font-bold text-white hover:bg-[#27496D] transition shadow-2xs cursor-pointer disabled:opacity-50"
                        disabled={isLoadingEdit}
                        type="button"
                        onClick={() => handleOpenEdit(p.id)}
                      >
                        <MaterialIcon className="text-[14px]" name="settings" />
                        <span>{isLoadingEdit ? "Đang tải..." : "⚙️ Cài đặt / Sửa"}</span>
                      </button>

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

      {/* MODAL EDITOR: CÀI ĐẶT SỐ LƯỢNG LỰA CHỌN, UP ẢNH, NHẬP THÀNH VIÊN */}
      <PollEditorModal
        initialPoll={editingPollDetail}
        isOpen={isEditorOpen}
        mode={modalMode}
        onClose={() => setIsEditorOpen(false)}
        onSaved={() => {
          router.refresh();
          setSuccessMessage("Đã lưu cập nhật chương trình bình chọn thành công!");
        }}
      />
    </div>
  );
}
