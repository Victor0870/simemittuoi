import Image from "next/image";
import Link from "next/link";
import { LOGO_URL } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="w-full bg-inverse-surface py-8 text-inverse-on-surface">
      <div className="flex w-full flex-col items-center justify-between gap-8 px-margin-mobile py-8 md:flex-row md:px-margin-desktop">
        <div className="flex flex-col items-center gap-4 md:items-start">
          <div className="flex items-center gap-2">
            <Image
              alt="Logo"
              className="brightness-200"
              height={40}
              src={LOGO_URL}
              width={40}
            />
            <span className="text-headline-md font-extrabold text-white">
              Si Mê Mít Tươi
            </span>
          </div>
          <p className="text-center text-body-md opacity-80 md:text-left">
            © 2026 Si Mê Mít Tươi. Nâng tầm sức mạnh tập thể.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          <Link
            className="text-label-sm text-white opacity-80 transition-colors hover:opacity-100"
            href="#"
          >
            Chính sách bảo mật
          </Link>
          <Link
            className="text-label-sm text-white opacity-80 transition-colors hover:opacity-100"
            href="#"
          >
            Điều khoản dịch vụ
          </Link>
          <Link
            className="text-label-sm text-white opacity-80 transition-colors hover:opacity-100"
            href="#"
          >
            Liên hệ Đại diện
          </Link>
        </div>
      </div>
    </footer>
  );
}
