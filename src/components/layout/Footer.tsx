import Image from "next/image";
import Link from "next/link";
import { LOGO_URL } from "@/lib/constants";

export function Footer() {
  return (
    <footer
      className="w-full border-t border-[#A8DDD1]/40 py-8 shadow-[0_-1px_3px_rgba(23,58,103,0.06)] md:ml-64 md:w-[calc(100%-16rem)]"
      style={{ backgroundColor: "#D9F2EC" }}
    >
      <div className="flex w-full flex-col items-center justify-between gap-8 px-margin-mobile py-8 md:flex-row md:px-margin-desktop">
        <div className="flex flex-col items-center gap-4 md:items-start">
          <div className="flex items-center gap-2">
            <Image alt="Logo" height={40} src={LOGO_URL} width={40} />
            <span className="text-headline-md font-extrabold text-[#173A67]">
              Si Mê Mít Tươi
            </span>
          </div>
          <p className="text-center text-body-md text-[#27496D] md:text-left">
            © 2026 Si Mê Mít Tươi. Nâng tầm sức mạnh tập thể.
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
