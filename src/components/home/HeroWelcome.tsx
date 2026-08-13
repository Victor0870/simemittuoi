import type { DashboardUser } from "@/lib/data/home";

type HeroWelcomeProps = {
  user: DashboardUser;
  isGuest?: boolean;
};

export function HeroWelcome({ user, isGuest = false }: HeroWelcomeProps) {
  return (
    <div
      className={`relative flex h-64 flex-col justify-center overflow-hidden rounded-3xl bg-primary-container p-8 text-on-primary-container shadow-lg ${
        isGuest ? "lg:col-span-3" : "lg:col-span-2"
      }`}
    >
      <h1 className="mb-2 text-headline-xl text-on-primary-container">
        {isGuest
          ? "Chào mừng đến Si Mê Mít Tươi!"
          : `Chào mừng, ${user.name}!`}
      </h1>
      <p className="max-w-md text-body-lg text-on-primary-container/80 opacity-90">
        {isGuest
          ? "Theo dõi hoạt động công đoàn và bảng xếp hạng. Đăng nhập để xem thành tích cá nhân đầy đủ."
          : `Hôm nay bạn có ${user.newActivitiesCount} hoạt động mới để tích lũy điểm thưởng. Cùng nhau xây dựng cộng đồng vững mạnh.`}
      </p>
    </div>
  );
}
