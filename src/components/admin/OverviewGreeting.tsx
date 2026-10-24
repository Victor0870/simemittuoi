"use client";

import { useAuth } from "@/components/auth/AuthProvider";

/** Lời chào trang tổng quan; khi server không truyền tên thì lấy tên từ hồ sơ đang đăng nhập. */
export function OverviewGreeting({ name }: { name?: string | null }) {
  const { profile } = useAuth();
  const displayName = name || profile?.full_name || "bạn";
  return (
    <div>
      <h1 className="text-headline-md font-extrabold text-[#173A67]">Chào {displayName} 👋</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Những việc cần chú ý hôm nay</p>
    </div>
  );
}
