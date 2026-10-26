"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type Props = {
  /** Trang /admin đích; nút chỉ hiện khi người dùng mở được trang này. */
  href: string;
  label: string;
  icon?: string;
  className?: string;
};

/** Nút tắt nhỏ trên trang công khai dẫn tới trang quản trị tương ứng (người thường không thấy). */
export function AdminShortcutLink({ href, label, icon = "admin_panel_settings", className = "" }: Props) {
  const { loading, canOpenAdmin } = useAuth();
  if (loading || !canOpenAdmin(href)) return null;

  return (
    <Link
      prefetch={false}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#173A67]/30 bg-[#D9F2EC] px-3 py-1.5 text-xs font-bold text-[#173A67] transition hover:bg-[#c6eae1] ${className}`}
      href={href}
      title="Mở trong Trang quản trị"
    >
      <MaterialIcon className="text-[16px]" name={icon} />
      <span>{label}</span>
    </Link>
  );
}
