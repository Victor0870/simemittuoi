"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlbumEditorModal } from "@/components/albums/AlbumEditorModal";
import { PhotoViewerModal } from "@/components/albums/PhotoViewerModal";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { AlbumPhoto, AlbumSummary } from "@/lib/data/albums";
import { resizeImageToBlob } from "@/lib/image-resize";

type AlbumDetailClientProps = {
  album: AlbumSummary;
  initialPhotos: AlbumPhoto[];
  initialPhotoId: string | null;
  isAdmin: boolean;
  currentUserId: string;
};

type PendingUpload = {
  key: string;
  file: File;
  previewUrl: string;
  caption: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

type Notice = { type: "success" | "error"; text: string };

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export function AlbumDetailClient({
  album,
  initialPhotos,
  initialPhotoId,
  isAdmin,
  currentUserId,
}: AlbumDetailClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<AlbumPhoto[]>(initialPhotos);
  const [viewerPhotoId, setViewerPhotoId] = useState<string | null>(initialPhotoId);
  const [onlyMine, setOnlyMine] = useState(false);
  const [queue, setQueue] = useState<PendingUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [deletingAlbum, setDeletingAlbum] = useState(false);

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (viewerPhotoId) url.searchParams.set("photo", viewerPhotoId);
    else url.searchParams.delete("photo");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [viewerPhotoId]);

  const queueRef = useRef<PendingUpload[]>([]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    return () => {
      queueRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const myPhotoCount = useMemo(
    () => photos.filter((p) => p.userId === currentUserId).length,
    [photos, currentUserId],
  );
  const canUpload = isAdmin || album.allowMemberUpload;
  const remaining = isAdmin
    ? Number.POSITIVE_INFINITY
    : Math.max(0, album.maxPhotosPerMember - myPhotoCount);

  const visiblePhotos = onlyMine ? photos.filter((p) => p.userId === currentUserId) : photos;
  const viewerIndex = viewerPhotoId ? visiblePhotos.findIndex((p) => p.id === viewerPhotoId) : -1;

  function showNotice(next: Notice) {
    setNotice(next);
    setTimeout(() => setNotice((curr) => (curr === next ? null : curr)), 6000);
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;

    const pendingCount = queue.filter((q) => q.status !== "done").length;
    const slots = isAdmin ? files.length : Math.max(0, remaining - pendingCount);
    const accepted: PendingUpload[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        rejected.push(`${file.name}: không phải ảnh`);
        continue;
      }
      if (file.size > MAX_SOURCE_BYTES) {
        rejected.push(`${file.name}: vượt quá 20MB`);
        continue;
      }
      if (accepted.length >= slots) {
        rejected.push(`${file.name}: vượt giới hạn ${album.maxPhotosPerMember} ảnh/người`);
        continue;
      }
      accepted.push({
        key: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
        status: "pending",
      });
    }

    if (accepted.length > 0) setQueue((prev) => [...prev, ...accepted]);
    if (rejected.length > 0) {
      showNotice({ type: "error", text: `Bỏ qua ${rejected.length} tệp — ${rejected.join("; ")}` });
    }
  }

  function removeFromQueue(key: string) {
    setQueue((prev) => {
      const item = prev.find((q) => q.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((q) => q.key !== key);
    });
  }

  async function handleUploadAll() {
    if (uploading) return;
    const items = queue.filter((q) => q.status === "pending" || q.status === "error");
    if (items.length === 0) return;

    setUploading(true);
    setNotice(null);
    let successCount = 0;
    let totalPoints = 0;
    let lastError: string | null = null;

    for (const item of items) {
      let limitReached = false;
      setQueue((prev) => prev.map((q) => (q.key === item.key ? { ...q, status: "uploading" } : q)));
      try {
        const blob = await resizeImageToBlob(item.file);
        const ext = blob.type === "image/gif" ? "gif" : "jpg";
        const form = new FormData();
        form.append("albumId", album.id);
        form.append("caption", item.caption.trim());
        form.append("file", blob, `photo.${ext}`);

        const res = await fetch("/api/albums/photos", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          limitReached = Boolean(data.limitReached);
          throw new Error(data.error || "Đăng ảnh không thành công.");
        }

        successCount++;
        totalPoints += Number(data.pointsAwarded) || 0;
        setQueue((prev) => prev.map((q) => (q.key === item.key ? { ...q, status: "done" } : q)));
      } catch (err: any) {
        const message: string = err?.message || "Đăng ảnh không thành công.";
        lastError = message;
        setQueue((prev) =>
          prev.map((q) => (q.key === item.key ? { ...q, status: "error", error: message } : q)),
        );
      }
      if (limitReached) break;
    }

    setQueue((prev) => {
      prev.filter((q) => q.status === "done").forEach((q) => URL.revokeObjectURL(q.previewUrl));
      return prev.filter((q) => q.status !== "done");
    });
    setUploading(false);

    if (successCount > 0) {
      showNotice({
        type: "success",
        text:
          `Đã đăng ${successCount} ảnh thành công!` +
          (totalPoints > 0 ? ` Bạn nhận được +${totalPoints} điểm thi đua.` : ""),
      });
      router.refresh();
    } else if (lastError) {
      showNotice({ type: "error", text: lastError });
    }
  }

  const handlePhotoChange = useCallback((photoId: string, patch: Partial<AlbumPhoto>) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, ...patch } : p)));
  }, []);

  const handlePhotoDeleted = useCallback(
    (photoId: string, message: string) => {
      setViewerPhotoId(null);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      showNotice({ type: "success", text: message });
      router.refresh();
    },
    [router],
  );

  const handleSetCover = useCallback(
    async (photo: AlbumPhoto) => {
      try {
        const res = await fetch("/api/albums", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: album.id, coverOnly: true, coverUrl: photo.imageUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể đặt ảnh bìa.");
        showNotice({ type: "success", text: "Đã đặt làm ảnh bìa album." });
      } catch (err: any) {
        showNotice({ type: "error", text: err?.message || "Không thể đặt ảnh bìa." });
      }
    },
    [album.id],
  );

  async function handleDeleteAlbum() {
    if (deletingAlbum) return;
    const confirmed = window.confirm(
      `Xóa album “${album.title}” cùng toàn bộ ${photos.length} ảnh? Điểm thi đua đã cộng từ ảnh và bình luận trong album sẽ bị thu hồi. Thao tác không thể hoàn tác.`,
    );
    if (!confirmed) return;

    setDeletingAlbum(true);
    try {
      const res = await fetch(`/api/albums?id=${encodeURIComponent(album.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể xóa album.");
      router.push("/albums");
      router.refresh();
    } catch (err: any) {
      showNotice({ type: "error", text: err?.message || "Không thể xóa album." });
      setDeletingAlbum(false);
    }
  }

  const pendingQueue = queue.filter((q) => q.status !== "done");

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
        <Link className="transition hover:text-primary" href="/albums">
          Album ảnh
        </Link>
        <MaterialIcon className="text-[14px]" name="chevron_right" />
        <span className="line-clamp-1 font-medium text-on-surface">{album.title}</span>
      </nav>

      <header className="overflow-hidden rounded-2xl border border-dusty-border/80 bg-gradient-to-r from-dusty-light/80 via-white to-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <MaterialIcon className="text-[26px] text-primary" filled name="folder" />
              <h1 className="text-xl font-extrabold tracking-tight text-on-surface sm:text-headline-lg">
                {album.title}
              </h1>
              {!album.isActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  <MaterialIcon className="text-[13px]" name="visibility_off" />
                  Đang ẩn với thành viên
                </span>
              )}
            </div>
            {album.description && (
              <p className="max-w-3xl whitespace-pre-wrap text-body-sm text-on-surface-variant sm:text-body-md">
                {album.description}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-dusty-light px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                <MaterialIcon className="text-[13px]" name="photo_camera" />
                {photos.length} ảnh
              </span>
              {album.allowMemberUpload ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                  <MaterialIcon className="text-[13px]" name="groups" />
                  Thành viên được đăng tối đa {album.maxPhotosPerMember} ảnh/người
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-dusty-border bg-white px-2.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                  <MaterialIcon className="text-[13px]" name="shield" />
                  Chỉ Admin đăng ảnh
                </span>
              )}
              {album.allowMemberUpload && album.uploadPoints > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                  <MaterialIcon className="text-[13px] text-amber-600" name="military_tech" />
                  +{album.uploadPoints}đ / ảnh
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                <MaterialIcon className="text-[13px] text-amber-600" name="forum" />
                +1đ / bình luận (tối đa 3/ảnh)
              </span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary bg-white px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/5"
              >
                <MaterialIcon className="text-[17px]" name="settings" />
                Cài đặt
              </button>
              <button
                type="button"
                onClick={handleDeleteAlbum}
                disabled={deletingAlbum}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
              >
                <MaterialIcon className="text-[17px]" name="delete" />
                {deletingAlbum ? "Đang xóa..." : "Xóa album"}
              </button>
            </div>
          )}
        </div>
      </header>

      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl p-3.5 text-sm font-semibold ${
            notice.type === "success"
              ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border border-red-300 bg-red-50 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <MaterialIcon className="text-[20px]" name={notice.type === "success" ? "check_circle" : "error"} />
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} aria-label="Đóng thông báo">
            <MaterialIcon className="text-[16px]" name="close" />
          </button>
        </div>
      )}

      {/* Khu vực đăng ảnh */}
      {canUpload ? (
        <section className="space-y-4 rounded-2xl border border-dusty-border/80 bg-surface-container-lowest p-4 shadow-xs sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-on-surface-variant sm:text-body-sm">
              {isAdmin ? (
                <span className="font-semibold text-amber-800">
                  Quản trị viên đăng ảnh không giới hạn
                </span>
              ) : (
                <span>
                  Bạn đã đăng{" "}
                  <strong className="text-primary">
                    {myPhotoCount}/{album.maxPhotosPerMember}
                  </strong>{" "}
                  ảnh
                  {remaining > 0 ? ` (còn ${remaining} lượt)` : " — đã đủ giới hạn"}
                  {album.uploadPoints > 0 ? ` · +${album.uploadPoints}đ mỗi ảnh` : ""}
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading || (!isAdmin && remaining - pendingQueue.length <= 0)}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:cursor-not-allowed disabled:opacity-50 sm:text-label-md"
            >
              <MaterialIcon className="text-[18px]" name="add_a_photo" />
              Chọn ảnh để đăng
            </button>
          </div>

          {pendingQueue.length > 0 && (
            <div className="space-y-3">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pendingQueue.map((item) => (
                  <li
                    key={item.key}
                    className={`flex gap-3 rounded-xl border p-2.5 ${
                      item.status === "error" ? "border-red-300 bg-red-50/60" : "border-dusty-border bg-white"
                    }`}
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.previewUrl} alt="Ảnh chờ đăng" className="h-full w-full object-cover" />
                      {item.status === "uploading" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <input
                        type="text"
                        value={item.caption}
                        maxLength={500}
                        disabled={uploading}
                        onChange={(e) =>
                          setQueue((prev) =>
                            prev.map((q) => (q.key === item.key ? { ...q, caption: e.target.value } : q)),
                          )
                        }
                        placeholder="Chú thích (không bắt buộc)"
                        className="w-full rounded-lg border border-dusty-border px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                      />
                      {item.status === "error" && (
                        <p className="text-[11px] font-semibold text-red-700">{item.error}</p>
                      )}
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => removeFromQueue(item.key)}
                        className="mt-auto self-start text-[11px] font-semibold text-on-surface-variant hover:text-red-600 disabled:opacity-50"
                      >
                        Bỏ ảnh này
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleUploadAll}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Đang đăng ảnh...
                    </>
                  ) : (
                    <>
                      <MaterialIcon className="text-[18px]" name="cloud_upload" />
                      Đăng {pendingQueue.length} ảnh
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-dusty-border/80 bg-dusty-light/40 p-4 text-xs text-on-surface-variant sm:text-body-sm">
          <MaterialIcon className="text-[20px] text-primary" name="info" />
          Album này chỉ Quản trị viên đăng ảnh. Bạn có thể thả cảm xúc và bình luận để nhận điểm thi đua.
        </div>
      )}

      {/* Lưới ảnh */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyMine(false)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              !onlyMine ? "bg-primary text-white" : "bg-dusty-light text-primary hover:bg-dusty-light/70"
            }`}
          >
            Tất cả ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setOnlyMine(true)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              onlyMine ? "bg-primary text-white" : "bg-dusty-light text-primary hover:bg-dusty-light/70"
            }`}
          >
            Ảnh của tôi ({myPhotoCount})
          </button>
        </div>

        {visiblePhotos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dusty-border/80 bg-white/50 p-10 text-center">
            <MaterialIcon className="mx-auto mb-2 text-[40px] text-on-surface-variant/40" name="image" />
            <p className="text-body-sm font-medium text-on-surface-variant">
              {onlyMine ? "Bạn chưa đăng ảnh nào trong album này." : "Album chưa có ảnh nào."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {visiblePhotos.map((photo) => {
              const totalReactions = photo.reactions.like + photo.reactions.heart + photo.reactions.haha;
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    onClick={() => setViewerPhotoId(photo.id)}
                    className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl bg-slate-100 shadow-xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption || `Ảnh của ${photo.authorName}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8 text-left text-white">
                      <span className="truncate text-[11px] font-semibold">{photo.authorName}</span>
                      <span className="flex shrink-0 items-center gap-2 text-[11px] font-bold">
                        {totalReactions > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <MaterialIcon className="text-[13px]" filled name="favorite" />
                            {totalReactions}
                          </span>
                        )}
                        {photo.commentCount > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <MaterialIcon className="text-[13px]" name="chat_bubble" />
                            {photo.commentCount}
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {viewerIndex >= 0 && (
        <PhotoViewerModal
          album={album}
          photos={visiblePhotos}
          index={viewerIndex}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onNavigate={(i) => setViewerPhotoId(visiblePhotos[i]?.id ?? null)}
          onClose={() => setViewerPhotoId(null)}
          onPhotoChange={handlePhotoChange}
          onPhotoDeleted={handlePhotoDeleted}
          onSetCover={handleSetCover}
        />
      )}

      <AlbumEditorModal
        isOpen={showSettings}
        mode="edit"
        album={album}
        onClose={() => setShowSettings(false)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
