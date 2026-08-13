import Link from "next/link";
import type { DashboardUser } from "@/lib/data/home";

type HeroWelcomeProps = {
  user: DashboardUser;
  isGuest?: boolean;
};

export function HeroWelcome({ user, isGuest = false }: HeroWelcomeProps) {
  return (
    <div
      className={`relative flex flex-col justify-center overflow-hidden rounded-3xl bg-primary-container p-8 text-on-primary-container shadow-lg ${
        isGuest ? "min-h-64" : "min-h-56"
      }`}
    >
      {isGuest ? (
        <>
          <h1 className="mb-2 text-headline-xl text-on-primary-container">
            Xin chào khách vãng lai
          </h1>
          <p className="mb-6 max-w-xl text-body-lg text-on-primary-container/80 opacity-90">
            Đăng nhập hoặc đăng ký để đọc thêm được nhiều thông tin hơn
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-xl bg-tertiary px-5 py-3 text-sm font-bold text-on-tertiary transition-shadow hover:shadow-md"
              href="/login"
            >
              Đăng nhập
            </Link>
            <Link
              className="rounded-xl border-2 border-[#173A67] bg-white/70 px-5 py-3 text-sm font-bold text-[#173A67] transition-shadow hover:shadow-md"
              href="/register"
            >
              Đăng ký
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="mb-6 text-headline-xl text-on-primary-container">
            Chào mừng, {user.name}!
          </h1>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-xl bg-tertiary px-5 py-3 text-sm font-bold text-on-tertiary transition-shadow hover:shadow-md"
              href="/score-history"
            >
              Lịch sử điểm
            </Link>
            <Link
              className="rounded-xl border-2 border-[#173A67] bg-white/70 px-5 py-3 text-sm font-bold text-[#173A67] transition-shadow hover:shadow-md"
              href="/campaigns"
            >
              Chiến dịch mới
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
