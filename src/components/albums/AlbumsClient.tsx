"use client";

import Link from "next/link";
import { AdminShortcutLink } from "@/components/admin/AdminShortcutLink";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateTimeVi, getUploadWindowState, type AlbumSummary } from "@/lib/data/albums";

type AlbumsClientProps = {
  albums: AlbumSummary[];
  canManage: boolean;
};

export function AlbumsClient({ albums, canManage }: AlbumsClientProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-4 sm:gap-4 sm:pb-6">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="rounded-xl bg-primary/10 p-1.5 text-primary sm:p-2">
            <MaterialIcon className="text-[22px] sm:text-[28px]" name="photo_library" />
          </div>
          <div>
            <h1 className="text-title-lg font-extrabold tracking-tight text-[#173A67] sm:text-headline-lg">
              Album ảnh
            </h1>
            <p className="text-xs text-on-surface-variant sm:text-body-md">
              Khoảnh khắc hoạt động Công đoàn — dành riêng cho thành viên
            </p>
          </div>
        </div>

        <AdminShortcutLink href="/admin/content/albums" icon="photo_library" label="Quản lý album" />
      </header>

      {albums.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-12 text-center">
          <MaterialIcon className="mx-auto mb-3 text-[48px] text-on-surface-variant/40" name="folder_open" />
          <h3 className="text-title-md font-bold text-[#173A67]">Chưa có album nào</h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {canManage
              ? "Tạo album mới trong Trang quản trị (nút “Quản lý album”) để bắt đầu chia sẻ hình ảnh hoạt động."
              : "Ban Chấp hành Công đoàn sẽ sớm cập nhật các album ảnh hoạt động tại đây."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/albums/${album.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-dusty-border/80 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-dusty-light to-primary/10">
                {album.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={album.coverUrl}
                    alt={album.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <MaterialIcon className="text-[56px] text-primary/40" filled name="folder" />
                  </div>
                )}

                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs">
                  <MaterialIcon className="text-[13px]" name="photo_camera" />
                  {album.photoCount}
                </span>

                {!album.isActive && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    <MaterialIcon className="text-[12px]" name="visibility_off" />
                    Đang ẩn
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
                <h3 className="line-clamp-2 text-sm font-bold text-on-surface transition-colors group-hover:text-primary sm:text-title-sm">
                  {album.title}
                </h3>
                {album.description && (
                  <p className="line-clamp-2 text-[11px] text-on-surface-variant sm:text-xs">
                    {album.description}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap gap-1 pt-1">
                  {(() => {
                    const windowState = getUploadWindowState(album.uploadStartsAt, album.uploadEndsAt);
                    if (!album.allowMemberUpload) {
                      return (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-dusty-border bg-dusty-light px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          <MaterialIcon className="text-[12px]" name="shield" />
                          Quản lý đăng
                        </span>
                      );
                    }
                    if (windowState !== "open") {
                      return (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                          <MaterialIcon className="text-[12px]" name="schedule" />
                          {windowState === "ended" ? "Hết hạn đăng ảnh" : "Sắp mở nhận ảnh"}
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        <MaterialIcon className="text-[12px]" name="add_a_photo" />
                        {album.uploadEndsAt
                          ? `Nhận ảnh đến ${formatDateTimeVi(album.uploadEndsAt)}`
                          : "Mời đăng ảnh"}
                      </span>
                    );
                  })()}
                  {album.allowMemberUpload && album.uploadPoints > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                      +{album.uploadPoints}đ/ảnh
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
