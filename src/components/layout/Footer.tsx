import Link from "next/link";
import { BRAND, BRAND_COPYRIGHT } from "@/lib/brand";

export function Footer() {
  return (
    <footer
      className="w-full border-t border-[#A8DDD1]/40 py-8 shadow-[0_-1px_3px_rgba(23,58,103,0.06)]"
      style={{ backgroundColor: "#D9F2EC" }}
    >
      <div className="flex w-full flex-col items-center justify-between gap-8 px-margin-mobile py-8 md:flex-row md:px-margin-desktop">
        <div className="flex flex-col items-center gap-4 md:items-start">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#27496D]">
            {BRAND.name}
          </span>
          <p className="text-center text-body-md text-[#27496D] md:text-left">
            {BRAND_COPYRIGHT}
          </p>
          <p className="text-center text-label-sm text-[#27496D]/80 md:text-left">
            {BRAND.domain}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          <Link
            className="text-label-sm text-[#27496D] transition-colors hover:text-[#173A67]"
            href="#"
          >
            Chính sách bảo mật
          </Link>
          <Link
            className="text-label-sm text-[#27496D] transition-colors hover:text-[#173A67]"
            href="#"
          >
            Điều khoản dịch vụ
          </Link>
          <Link
            className="text-label-sm text-[#27496D] transition-colors hover:text-[#173A67]"
            href="#"
          >
            Liên hệ Đại diện
          </Link>
        </div>
      </div>
    </footer>
  );
}
