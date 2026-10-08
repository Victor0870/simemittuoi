import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { DashboardUser } from "@/lib/data/home";

type HeroWelcomeProps = {
  user: DashboardUser;
  isGuest?: boolean;
};

export function HeroWelcome({ user, isGuest = false }: HeroWelcomeProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-dusty-border/80 bg-gradient-to-r from-dusty-light/90 via-surface-muted to-white p-6 shadow-sm sm:p-8">
      <div className="pointer-events-none absolute -top-12 -right-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute right-32 -bottom-10 h-48 w-48 rounded-full bg-amber-honor/10 blur-2xl" />

      <div className="relative z-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div className="max-w-2xl space-y-3">
          {isGuest ? (
            <>
              <h1 className="text-headline-lg font-extrabold tracking-tight text-on-surface">
                Xin chào{" "}
                <span className="text-primary underline decoration-dusty-slate/60 decoration-wavy decoration-2">
                  Khách vãng lai
                </span>
                !
              </h1>
              <p className="max-w-xl text-body-md text-on-surface-variant">
                Đăng nhập hoặc đăng ký tài khoản đoàn viên để mở khóa bảng quyền
                lợi CDILV, tích lũy điểm phong trào và theo dõi bảng xếp hạng
                minh bạch.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-headline-lg font-extrabold tracking-tight text-on-surface">
                Xin chào{" "}
                <span className="text-primary">{user.name}</span>!
              </h1>
              <p className="max-w-xl text-body-md text-on-surface-variant">
                Bạn đang đứng hạng{" "}
                <strong className="text-primary">
                  {user.rank > 0 ? `#${user.rank}` : "—"}
                </strong>{" "}
                với{" "}
                <strong className="text-primary">
                  {user.score.toLocaleString("vi-VN")} điểm
                </strong>
                . Tiếp tục tham gia hoạt động để tăng hạng.
              </p>
            </>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          {isGuest ? (
            <>
              <Link
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-label-lg font-bold text-white shadow-md shadow-primary/25 transition-all hover:bg-dusty-dark active:scale-95 sm:flex-none"
                href="/login"
              >
                <MaterialIcon className="text-[20px]" name="login" />
                Đăng nhập ngay
              </Link>
              <Link
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary px-5 py-3 text-label-lg font-semibold text-primary transition-all hover:bg-primary/10 active:scale-95 sm:flex-none"
                href="/register"
              >
                <MaterialIcon className="text-[20px]" name="how_to_reg" />
                Đăng ký
              </Link>
            </>
          ) : (
            <>
              <Link
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-label-lg font-bold text-white shadow-md shadow-primary/25 transition-all hover:bg-dusty-dark active:scale-95 sm:flex-none"
                href="/score-history"
              >
                <MaterialIcon className="text-[20px]" name="history" />
                Lịch sử điểm
              </Link>
              <Link
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary px-5 py-3 text-label-lg font-semibold text-primary transition-all hover:bg-primary/10 active:scale-95 sm:flex-none"
                href="/leaderboard"
              >
                <MaterialIcon className="text-[20px]" name="leaderboard" />
                Bảng xếp hạng
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
