"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PostComment } from "@/lib/data/posts";
import { downloadImageFile, parseCommentContent } from "@/lib/post-comment-content";

type Submission = {
  url: string;
  authorName: string;
  authorDepartment: string | null;
  authorCode: string | null;
  commentId: string;
  timeAgo: string;
  filename: string;
};

function safeName(name: string | null | undefined): string {
  return (name || "tac_gia").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, "_");
}

/** Tổng hợp ảnh dự thi gửi qua bình luận của bài cuộc thi: tải từng ảnh / tải toàn bộ, chép link để tạo bình chọn. */
export function ContestSubmissionsManager({ postId, postTitle }: { postId: string; postTitle: string }) {
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts/comments?postId=${encodeURIComponent(postId)}`, { cache: "no-store" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || !Array.isArray(data.comments)) throw new Error(data.error || "Không tải được bình luận.");
        setComments(data.comments as PostComment[]);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không tải được bình luận.");
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const submissions = useMemo<Submission[]>(
    () =>
      (comments ?? [])
        .filter((c) => !c.parentId)
        .flatMap((c) =>
          parseCommentContent(c.content).imageUrls.map((url, idx) => ({
            url,
            authorName: c.authorName,
            authorDepartment: c.authorDepartment,
            authorCode: c.authorCode,
            commentId: c.id,
            timeAgo: c.timeAgo,
            filename: `Logo_CDILV_${safeName(c.authorName)}_${c.id.slice(0, 6)}${idx > 0 ? `_${idx + 1}` : ""}.png`,
          })),
        ),
    [comments],
  );

  async function handleDownload(item: Submission) {
    setDownloadingUrl(item.url);
    try {
      await downloadImageFile(item.url, item.filename);
    } finally {
      setDownloadingUrl(null);
    }
  }

  async function handleDownloadAll() {
    if (downloadingAll || submissions.length === 0) return;
    setDownloadingAll(true);
    setNotice(null);
    try {
      for (const item of submissions) {
        await handleDownload(item);
        // Nghỉ 350ms giữa các lần tải để trình duyệt không chặn nhiều file tải xuống
        await new Promise((r) => setTimeout(r, 350));
      }
      setNotice(`Đã hoàn tất tải ${submissions.length} ảnh dự thi về máy.`);
    } catch {
      setNotice("Có lỗi khi tải hàng loạt ảnh. Bạn có thể bấm Tải ảnh trên từng tác phẩm.");
    } finally {
      setDownloadingAll(false);
    }
  }

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2500);
    } catch {
      // trình duyệt chặn clipboard: bỏ qua
    }
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant pb-5">
        <div className="min-w-0">
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Tác phẩm dự thi</h1>
          <p className="text-body-md text-[#27496D]">
            Ảnh dự thi gửi qua bình luận của bài{" "}
            <Link prefetch={false} className="font-semibold text-primary hover:underline" href={`/posts/${postId}`}>
              {postTitle}
            </Link>
            . Tải về hoặc chép link ảnh để tạo danh sách bình chọn.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-xs transition hover:bg-dusty-dark disabled:opacity-50"
            disabled={downloadingAll || submissions.length === 0}
            type="button"
            onClick={handleDownloadAll}
          >
            <MaterialIcon className="text-[18px]" name={downloadingAll ? "progress_activity" : "cloud_download"} />
            <span>{downloadingAll ? "Đang tải..." : `Tải toàn bộ (${submissions.length} ảnh)`}</span>
          </button>
          <Link
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary bg-white px-3.5 py-2 text-sm font-bold text-primary transition hover:bg-primary/5"
            href="/admin/polls"
          >
            <MaterialIcon className="text-[18px]" name="how_to_vote" />
            <span>Tạo cuộc bình chọn</span>
          </Link>
        </div>
      </div>

      {notice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">{notice}</p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
      ) : comments === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface-container/60" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant bg-white px-4 py-12 text-center text-sm text-on-surface-variant">
          Chưa có ảnh dự thi nào trong bình luận.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {submissions.map((item) => (
            <div key={item.url} className="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`Tác phẩm của ${item.authorName}`} className="aspect-square w-full bg-slate-50 object-contain" loading="lazy" src={item.url} />
              <div className="space-y-2 p-3">
                <div>
                  <p className="font-bold text-[#173A67]">{item.authorName}</p>
                  <p className="text-xs text-on-surface-variant">
                    {[item.authorCode, item.authorDepartment, item.timeAgo].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-white transition hover:bg-dusty-dark disabled:opacity-50"
                    disabled={downloadingUrl === item.url}
                    type="button"
                    onClick={() => void handleDownload(item)}
                  >
                    <MaterialIcon className="text-[15px]" name="download" />
                    Tải ảnh
                  </button>
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-dusty-border bg-dusty-light/60 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-dusty-light"
                    title="Sao chép link ảnh để tạo bài thi trong bình chọn"
                    type="button"
                    onClick={() => void handleCopyLink(item.url)}
                  >
                    <MaterialIcon className="text-[15px]" name={copiedUrl === item.url ? "done" : "content_copy"} />
                    {copiedUrl === item.url ? "Đã chép link" : "Copy link"}
                  </button>
                  <a
                    className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs text-on-surface-variant transition hover:text-primary"
                    href={item.url}
                    rel="noopener noreferrer"
                    target="_blank"
                    title="Xem ảnh gốc trong tab mới"
                  >
                    <MaterialIcon className="text-[15px]" name="open_in_new" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
