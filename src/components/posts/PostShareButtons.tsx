"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { BRAND } from "@/lib/brand";

type PostShareButtonsProps = {
  postId: string;
  postTitle: string;
  postExcerpt?: string;
  variant?: "full" | "compact" | "card";
  className?: string;
};

function FacebookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function PostShareButtons({
  postId,
  postTitle,
  postExcerpt,
  variant = "compact",
  className = "",
}: PostShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setHasNativeShare(typeof navigator.share === "function");
      setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    }
  }, []);

  function getShareUrl(forFacebook = false) {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      // Khi test ở localhost, Facebook crawler không đọc được URL localhost, dùng canonical domain BRAND.siteUrl
      if (forFacebook && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
        return `${BRAND.siteUrl}/posts/${postId}`;
      }
      return `${origin}/posts/${postId}`;
    }
    return `${BRAND.siteUrl}/posts/${postId}`;
  }

  function openFacebookWebDialog(targetUrl: string) {
    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}`;

    const width = 640;
    const height = 560;
    const left =
      typeof window !== "undefined"
        ? Math.max(0, (window.innerWidth - width) / 2 + window.screenX)
        : 100;
    const top =
      typeof window !== "undefined"
        ? Math.max(0, (window.innerHeight - height) / 2 + window.screenY)
        : 100;

    window.open(
      fbShareUrl,
      "facebook-share-dialog",
      `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
    );
  }

  /**
   * Chia sẻ bài viết:
   * - Trên mobile có hỗ trợ Web Share API: Kích hoạt bảng chia sẻ hệ điều hành (iOS / Android)
   *   -> Người dùng bấm chọn icon Facebook hoặc Zalo là nhảy THẲNG VÀO APP Facebook trên máy đã đăng nhập sẵn tài khoản.
   * - Trên PC/desktop: Mở popup Web Facebook Dialog (vì người dùng PC hầu như đã đăng nhập sẵn trên browser).
   */
  async function handleShareFacebook(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetUrl = getShareUrl(true);

    if (isMobile && hasNativeShare) {
      try {
        await navigator.share({
          title: postTitle,
          url: targetUrl,
        });
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
      }
    }

    openFacebookWebDialog(targetUrl);
  }

  async function handleCopyLink(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetUrl = getShareUrl(false);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(targetUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = targetUrl;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Sao chép liên kết bên dưới:", targetUrl);
    }
  }

  async function handleNativeShare(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetUrl = getShareUrl(false);
    try {
      await navigator.share({
        title: postTitle,
        url: targetUrl,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Lỗi khi chia sẻ:", err);
      }
    }
  }

  // Variant dành riêng cho PostCard (gọn, không choán diện tích, có stopPropagation)
  if (variant === "card") {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <button
          type="button"
          onClick={handleShareFacebook}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-dusty-border/80 bg-white text-[#1877F2] transition-colors hover:border-[#1877F2]/50 hover:bg-[#1877F2]/10 cursor-pointer"
          title={isMobile ? "Chia sẻ qua App Facebook / Zalo" : "Chia sẻ lên Facebook"}
          aria-label="Chia sẻ lên Facebook"
        >
          <FacebookIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
            copied
              ? "border-emerald-500 bg-emerald-50 text-emerald-600"
              : "border-dusty-border/80 bg-white text-on-surface-variant hover:border-primary/50 hover:bg-dusty-light/60 hover:text-primary"
          }`}
          title={copied ? "Đã sao chép liên kết!" : "Sao chép liên kết"}
          aria-label="Sao chép liên kết"
        >
          <MaterialIcon
            className="text-[17px]"
            name={copied ? "check" : "content_copy"}
          />
        </button>
      </div>
    );
  }

  // Variant compact: hiển thị trên header trang chi tiết bài viết
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={handleShareFacebook}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#1877F2] px-3 py-1.5 text-label-xs sm:text-label-sm font-bold text-white shadow-xs transition-all hover:bg-[#166fe5] hover:shadow-sm active:scale-95 cursor-pointer"
          title={isMobile ? "Mở app Facebook / Zalo để chia sẻ" : "Chia sẻ bài viết lên Facebook"}
        >
          <FacebookIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>{isMobile ? "Chia sẻ" : "Chia sẻ FB"}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-label-xs sm:text-label-sm font-semibold transition-all cursor-pointer ${
            copied
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-dusty-border bg-white text-on-surface-variant hover:border-primary/40 hover:bg-dusty-light/50 hover:text-primary"
          }`}
          title={copied ? "Đã sao chép liên kết!" : "Sao chép liên kết"}
        >
          <MaterialIcon
            className={`text-[15px] sm:text-[16px] ${copied ? "text-emerald-600" : ""}`}
            name={copied ? "check" : "link"}
          />
          <span className="hidden sm:inline">
            {copied ? "Đã chép link" : "Sao chép link"}
          </span>
        </button>

        {hasNativeShare && !isMobile ? (
          <button
            type="button"
            onClick={handleNativeShare}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-dusty-border bg-white text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-dusty-light/50 hover:text-primary cursor-pointer"
            title="Chia sẻ khác"
            aria-label="Chia sẻ khác"
          >
            <MaterialIcon className="text-[16px]" name="share" />
          </button>
        ) : null}
      </div>
    );
  }

  // Variant full: Card hiển thị cuối bài viết
  return (
    <div
      className={`rounded-2xl border border-dusty-border/80 bg-gradient-to-r from-dusty-light/40 via-white to-dusty-light/30 p-4 sm:p-6 shadow-xs ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MaterialIcon className="text-[18px]" name="share" />
            </span>
            <h3 className="text-body-md sm:text-title-md font-bold text-on-surface">
              Chia sẻ bài viết này
            </h3>
          </div>
          <p className="text-xs sm:text-body-sm text-on-surface-variant">
            Lan tỏa thông tin đến các đoàn viên, đồng nghiệp trên mạng xã hội.
          </p>
          {isMobile ? (
            <p className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium pt-0.5">
              <MaterialIcon className="text-[14px]" name="check_circle" />
              <span>Trên điện thoại: Tự động mở App Facebook/Zalo đã đăng nhập sẵn trên máy</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nút Facebook Share chính */}
            <button
              type="button"
              onClick={handleShareFacebook}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2.5 text-label-sm sm:text-label-md font-bold text-white shadow-xs transition-all hover:bg-[#166fe5] hover:shadow-md active:scale-95 cursor-pointer"
            >
              <FacebookIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{isMobile ? "Chia sẻ qua App (FB/Zalo)" : "Chia sẻ lên Facebook"}</span>
            </button>

            {/* Nút Sao chép liên kết */}
            <button
              type="button"
              onClick={handleCopyLink}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-label-sm sm:text-label-md font-semibold transition-all cursor-pointer ${
                copied
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs"
                  : "border-dusty-border bg-white text-on-surface hover:border-primary/50 hover:bg-dusty-light/60 hover:text-primary"
              }`}
            >
              <MaterialIcon
                className={`text-[18px] ${copied ? "text-emerald-600" : ""}`}
                name={copied ? "check_circle" : "content_copy"}
              />
              <span>{copied ? "Đã sao chép liên kết!" : "Sao chép liên kết"}</span>
            </button>
          </div>

          {/* Nếu trên điện thoại muốn mở qua Web Browser thay vì App */}
          {isMobile ? (
            <button
              type="button"
              onClick={() => openFacebookWebDialog(getShareUrl(true))}
              className="text-center text-xs text-on-surface-variant hover:text-primary underline cursor-pointer pt-1 sm:pt-0"
            >
              Mở bằng Facebook web
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
