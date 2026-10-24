"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PollDetail, PollSummary } from "@/lib/data/polls";
import { PollEditorModal } from "@/components/polls/PollEditorModal";
import { POLL_PHASE_META, formatPollTime, getPollPhase } from "@/lib/polls/phase";

type Props = {
  polls: PollSummary[];
  currentAdminName: string;
  /** false: người được phân quyền bình chọn (ẩn các liên kết khu Admin). */
  isAdmin?: boolean;
};

export function AdminPollsManager({ polls, currentAdminName, isAdmin = true }: Props) {
  const router = useRouter();
  const [pollList, setPollList] = useState<PollSummary[]>(polls);
  const [renderedAt] = useState(() => Date.now());

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

  async function handleOpenNow(pollId: string, title: string) {
    if (!window.confirm(`Mở bình chọn NGAY cho "${title}"?\n\nTừ lúc này phiếu bình chọn sẽ được ghi nhận thật.`)) return;
    setBusyPollId(pollId);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/polls/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, status: "open" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Thao tác thất bại");
      setSuccessMessage(data.message || "Đã mở bình chọn!");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Lỗi khi mở bình chọn.");
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

  const columns: DataTableColumn<PollSummary>[] = [
    {
      key: "title",
      header: "Tên chương trình",
      className: "min-w-[11rem] max-w-[18rem] font-bold text-[#173A67]",
      render: (p) => (
        <>
          <div className="flex items-start gap-2">
            <Link className="line-clamp-2 break-words hover:underline" href={`/polls/${p.id}`} title={p.title}>
              {p.title}
            </Link>
            {!p.isActive ? (
              <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                Ẩn
              </span>
            ) : null}
          </div>
          {p.hasJudges && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-900 border border-amber-300">
                <MaterialIcon className="text-[12px]" name="gavel" />
                <span>BGK {p.judgeWeightPercent ?? 30}% ({p.judgeList?.length || 0} GK)</span>
              </span>
            </div>
          )}
        </>
      ),
    },
    {
      key: "pollType",
      header: "Hình thức",
      type: "enum",
      accessor: (p) => (p.pollType === "vote" ? "Vote tác phẩm" : "Trắc nghiệm"),
      className: "text-on-surface-variant",
    },
    {
      key: "accessType",
      header: "Đối tượng",
      type: "enum",
      accessor: (p) => (p.accessType === "free" ? "Free (IP check)" : "Đoàn viên"),
      render: (p) => (
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
      ),
    },
    {
      key: "isActive",
      header: "Hiển thị",
      type: "enum",
      accessor: (p) => (p.isActive ? "Active" : "Inactive"),
      render: (p) => (
        <button
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition cursor-pointer shadow-2xs border ${
            p.isActive
              ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
              : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
          } disabled:opacity-50`}
          disabled={busyPollId === p.id}
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
      ),
    },
    {
      key: "phase",
      header: "Tiến trình",
      accessor: (p) => POLL_PHASE_META[getPollPhase(p, renderedAt)].label,
      render: (p) => {
        const phase = getPollPhase(p, renderedAt);
        const phaseMeta = POLL_PHASE_META[phase];
        return (
          <>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${phaseMeta.chip}`}
            >
              <MaterialIcon className="text-[13px]" name={phaseMeta.icon} />
              {phaseMeta.label}
            </span>
            {phase === "upcoming" && p.opensAt ? (
              <div className="mt-1 text-[11px] font-medium leading-tight text-sky-800">
                Tự mở: <span className="whitespace-nowrap">{formatPollTime(p.opensAt)}</span>
              </div>
            ) : null}
            {(phase === "upcoming" || phase === "open") && p.votingEndsAt ? (
              <div className="mt-0.5 text-[11px] font-medium leading-tight text-amber-900">
                Dừng nhận phiếu: <span className="whitespace-nowrap">{formatPollTime(p.votingEndsAt)}</span>
              </div>
            ) : null}
          </>
        );
      },
    },
    {
      key: "createdAt",
      header: "Ngày tạo",
      type: "date",
      className: "whitespace-nowrap text-xs text-on-surface-variant",
      render: (p) => new Date(p.createdAt).toLocaleDateString("vi-VN"),
    },
    {
      key: "actions",
      header: "Thao tác",
      filterable: false,
      // Luôn thấy cột thao tác: dính mép phải nếu bảng phải cuộn ngang (màn hẹp)
      className:
        "sticky right-0 z-[1] whitespace-nowrap bg-surface-container-lowest text-right shadow-[inset_1px_0_0_rgb(0_0_0/0.06)]",
      headerClassName: "sticky right-0 z-20 bg-[#ecf4ff] text-right",
      render: (p) => {
        const phase = getPollPhase(p, renderedAt);
        const isBusy = busyPollId === p.id;
        const isLoadingEdit = loadingPollId === p.id;
        const iconButton =
          "inline-flex h-8 w-8 items-center justify-center rounded-lg transition shadow-2xs cursor-pointer disabled:cursor-wait disabled:opacity-50";
        const busyIcon = <MaterialIcon className="animate-spin text-[18px]" name="progress_activity" />;
        const editLabel = isLoadingEdit ? "Đang tải..." : "Cài đặt / Sửa";
        return (
          <div className="inline-flex items-center justify-end gap-1">
            {/* BUTTON CÀI ĐẶT & SỬA */}
            <button
              aria-label={editLabel}
              className={`${iconButton} bg-[#173A67] text-white hover:bg-[#27496D]`}
              disabled={isLoadingEdit}
              title={editLabel}
              type="button"
              onClick={() => handleOpenEdit(p.id)}
            >
              {isLoadingEdit ? busyIcon : <MaterialIcon className="text-[18px]" name="settings" />}
            </button>

            <Link
              aria-label="Xem trang"
              className={`${iconButton} border border-outline-variant bg-white text-[#173A67] hover:bg-surface-container-high`}
              href={`/polls/${p.id}`}
              title="Xem trang"
            >
              <MaterialIcon className="text-[18px]" name="open_in_new" />
            </Link>

            {phase === "upcoming" ? (
              <button
                aria-label={isBusy ? "Đang mở..." : "Mở ngay"}
                className={`${iconButton} bg-emerald-600 text-white hover:bg-emerald-700`}
                disabled={isBusy}
                title={isBusy ? "Đang mở..." : "Mở ngay"}
                type="button"
                onClick={() => handleOpenNow(p.id, p.title)}
              >
                {isBusy ? busyIcon : <MaterialIcon className="text-[18px]" name="play_arrow" />}
              </button>
            ) : phase !== "closed" ? (
              <button
                aria-label={isBusy ? "Đang tính..." : "Đóng & Trao giải"}
                className={`${iconButton} bg-amber-500 text-white hover:bg-amber-600`}
                disabled={isBusy}
                title={isBusy ? "Đang tính..." : "Đóng & Trao giải"}
                type="button"
                onClick={() => handleClosePoll(p.id, p.title)}
              >
                {isBusy ? busyIcon : <MaterialIcon className="text-[18px]" name="emoji_events" />}
              </button>
            ) : (
              <button
                aria-label={isBusy ? "Đang mở..." : "Mở lại"}
                className={`${iconButton} border border-primary bg-white text-primary hover:bg-primary/10`}
                disabled={isBusy}
                title={isBusy ? "Đang mở..." : "Mở lại"}
                type="button"
                onClick={() => handleReopenPoll(p.id)}
              >
                {isBusy ? busyIcon : <MaterialIcon className="text-[18px]" name="replay" />}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Header with Admin Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
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
                Bấm nút <strong>⚙️ (Cài đặt / Sửa)</strong> ở cột Thao tác của mỗi chương trình để: Thêm/bớt tác phẩm, up ảnh chụp máy ảnh (hệ thống tự động nén tối ưu), nhập danh sách đoàn viên cho từng nhóm.
              </li>
              <li>
                Bấm <strong>&ldquo;+ Tạo chương trình mới&rdquo;</strong> để tạo cuộc thi vote hoặc câu hỏi trắc nghiệm mới.
              </li>
              <li>
                Chọn giai đoạn <strong>&ldquo;Sắp mở&rdquo;</strong> trong Cài đặt để mọi người xem trước tác phẩm và <strong>bình chọn thử</strong> (không ghi nhận). Có thể hẹn giờ tự mở và giờ tự dừng nhận phiếu, hoặc bấm nút <strong>▶ (Mở ngay)</strong>.
              </li>
              <li>
                Khi chương trình kết thúc, bấm nút <strong>🏆 (Đóng & Trao giải)</strong>: Hệ thống sẽ tự động tìm người dự đoán đúng nhất và cộng điểm thi đua vào tài khoản của đoàn viên đạt giải!
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. BẢNG DANH SÁCH CÁC CHƯƠNG TRÌNH */}
      <div className="space-y-4 pb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-title-lg font-bold text-[#173A67]">
            Các Chương Trình Bình Chọn ({pollList.length})
          </h2>
          <span className="text-xs text-on-surface-variant font-medium">
            Đăng nhập bởi: <strong>{currentAdminName}</strong>
          </span>
        </div>

        <DataTable
          columns={columns}
          density="compact"
          emptyText="Chưa có chương trình bình chọn nào."
          maxHeightClass="max-h-[calc(100dvh-240px)] min-h-[240px]"
          rowKey={(p) => p.id}
          rows={pollList}
        />
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
