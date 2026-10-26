import Image from "next/image";
import type { ReactNode } from "react";

// Phải khớp images.remotePatterns trong next.config.ts; host khác hiển thị ảnh gốc.
const OPTIMIZED_HOSTS = new Set(["pzcwwylxrojvcoihtxep.supabase.co", "lh3.googleusercontent.com"]);

function canOptimize(src: string) {
  if (src.startsWith("/")) return true;
  try {
    return OPTIMIZED_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

type AvatarProps = {
  src?: string | null;
  alt: string;
  /** Kích thước hiển thị (px), dùng để tải ảnh đúng cỡ thay vì ảnh gốc. */
  size: number;
  className?: string;
  /** Hiển thị khi không có ảnh. */
  fallback?: ReactNode;
  /** "eager" cho ảnh luôn thấy ngay (thanh trên cùng); mặc định tải lười. */
  loading?: "eager" | "lazy";
};

/** Ảnh đại diện nhỏ qua next/image; không có url thì hiện fallback. */
export function Avatar({
  src,
  alt,
  size,
  className = "h-full w-full object-cover",
  fallback = null,
  loading,
}: AvatarProps) {
  if (!src) return <>{fallback}</>;
  return (
    <Image
      alt={alt}
      className={className}
      height={size}
      loading={loading}
      src={src}
      unoptimized={!canOptimize(src)}
      width={size}
    />
  );
}
