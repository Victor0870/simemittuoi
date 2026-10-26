"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { AlbumEditorModal } from "@/components/albums/AlbumEditorModal";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateTimeVi, getUploadWindowState, type AlbumSummary } from "@/lib/data/albums";

function uploadLabel(album: AlbumSummary): string {
  if (!album.allowMemberUpload) return "Chỉ quản lý đăng";
  const state = getUploadWindowState(album.uploadStartsAt, album.uploadEndsAt);
  if (state === "not_started") return "Sắp mở nhận ảnh";
  if (state === "ended") return "Hết hạn đăng ảnh";
  return "Đang nhận ảnh";
}

/** Quản lý album ảnh: tạo album, cài đặt (thời gian, điểm thưởng đăng ảnh, ẩn/hiện), xóa album. */
export function AdminAlbumsManager({ albums }: { albums: AlbumSummary[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AlbumSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(album: AlbumSummary) {
    if (deletingId) return;
    const confirmed = window.confirm(
      `Xóa album “${album.title}” cùng toàn bộ ${album.photoCount} ảnh? Điểm thi đua đã cộng từ ảnh và bình luận trong album sẽ bị thu hồi. Thao tác không thể hoàn tác.`,
    );
    if (!confirmed) return;

    setDeletingId(album.id);
    setError(null);
    try {
      const res = await fetch(`/api/albums?id=${encodeURIComponent(album.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không thể xóa album.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa album.");
    } finally {
      setDeletingId(null);
    }
  }

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border shadow-2xs transition disabled:cursor-wait disabled:opacity-50";

  const columns: DataTableColumn<AlbumSummary>[] = [
    {
      key: "title",
      header: "Album",
      className: "min-w-[14rem] max-w-[24rem] font-bold text-[#173A67]",
      render: (a) => (
        <div className="space-y-0.5">
          <Link className="line-clamp-2 break-words hover:underline" href={`/albums/${a.id}`} title={a.title}>
            {a.title}
          </Link>
          {a.description ? (
            <p className="line-clamp-1 text-xs font-normal text-on-surface-variant" title={a.description}>
              {a.description}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Hiển thị",
      type: "enum",
      accessor: (a) => (a.isActive ? "Đang hiện" : "Đang ẩn"),
      className: "whitespace-nowrap",
      render: (a) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
            a.isActive ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-100 text-slate-600"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${a.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
          {a.isActive ? "Đang hiện" : "Đang ẩn"}
        </span>
      ),
    },
    {
      key: "photoCount",
      header: "Số ảnh",
      type: "number",
      className: "whitespace-nowrap text-right",
      headerClassName: "text-right",
    },
    {
      key: "upload",
      header: "Đăng ảnh",
      type: "enum",
      accessor: uploadLabel,
      className: "text-xs text-on-surface-variant",
      render: (a) => (
        <div className="space-y-0.5">
          <span className="font-semibold text-on-surface">{uploadLabel(a)}</span>
          {a.allowMemberUpload && (a.uploadStartsAt || a.uploadEndsAt) ? (
            <div className="whitespace-nowrap">
              {a.uploadStartsAt ? `từ ${formatDateTimeVi(a.uploadStartsAt)}` : ""}
              {a.uploadEndsAt ? ` đến ${formatDateTimeVi(a.uploadEndsAt)}` : ""}
            </div>
          ) : null}
          {a.allowMemberUpload && a.uploadPoints > 0 ? <div>+{a.uploadPoints}đ/ảnh</div> : null}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Ngày tạo",
      type: "date",
      className: "whitespace-nowrap text-xs text-on-surface-variant",
      render: (a) => new Date(a.createdAt).toLocaleDateString("vi-VN"),
    },
    {
      key: "actions",
      header: "Thao tác",
      filterable: false,
      className: "whitespace-nowrap text-right",
      headerClassName: "text-right",
      render: (a) => (
        <div className="inline-flex items-center justify-end gap-1">
          <Link
            aria-label="Xem album"
            className={`${iconButton} border-outline-variant bg-white text-[#173A67] hover:bg-surface-container-high`}
            href={`/albums/${a.id}`}
            title="Xem album"
          >
            <MaterialIcon className="text-[18px]" name="open_in_new" />
          </Link>
          <button
            aria-label="Cài đặt album"
            className={`${iconButton} border-[#173A67] bg-[#173A67] text-white hover:bg-[#27496D]`}
            title="Cài đặt album"
            type="button"
            onClick={() => setEditing(a)}
          >
            <MaterialIcon className="text-[18px]" name="settings" />
          </button>
          <button
            aria-label="Xóa album"
            className={`${iconButton} border-red-200 bg-white text-red-700 hover:bg-red-50`}
            disabled={deletingId === a.id}
            title="Xóa album"
            type="button"
            onClick={() => void handleDelete(a)}
          >
            <MaterialIcon className="text-[18px]" name={deletingId === a.id ? "progress_activity" : "delete"} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Album ảnh</h1>
          <p className="text-body-md text-[#27496D]">
            Tạo album, cài đặt thời gian và điểm thưởng đăng ảnh, ẩn / hiện hoặc xóa album. Kiểm duyệt ảnh và bình luận
            ngay trong từng album.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark"
          type="button"
          onClick={() => setShowCreate(true)}
        >
          <MaterialIcon className="text-[18px]" name="create_new_folder" />
          Tạo album mới
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
      ) : null}

      <DataTable
        columns={columns}
        defaultPageSize={10}
        density="compact"
        emptyText="Chưa có album nào. Bấm “Tạo album mới” để bắt đầu."
        maxHeightClass="max-h-[calc(100dvh-300px)] min-h-[240px]"
        rowKey={(a) => a.id}
        rows={albums}
      />

      <AlbumEditorModal
        isOpen={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSaved={() => router.refresh()}
      />
      <AlbumEditorModal
        album={editing}
        isOpen={editing !== null}
        mode="edit"
        onClose={() => setEditing(null)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
