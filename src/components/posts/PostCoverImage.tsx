"use client";

import { useState } from "react";

type PostCoverImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Ảnh đầu trang chi tiết nên tải ngay; ảnh trong danh sách tải lười. */
  priority?: boolean;
};

/** Ảnh đại diện bài viết; không có ảnh hoặc ảnh lỗi thì không hiện gì (bố cục chữ vẫn đầy đủ). */
export function PostCoverImage({ src, alt, className, priority = false }: PostCoverImageProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={className}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      loading={priority ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      src={src}
      onError={() => setFailed(true)}
    />
  );
}
