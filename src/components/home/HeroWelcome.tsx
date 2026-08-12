import { MOCK_USER } from "@/lib/mock-data";

export function HeroWelcome() {
  return (
    <div className="relative flex h-64 flex-col justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-tertiary-container via-primary-container to-primary-container p-8 text-on-primary-container shadow-lg lg:col-span-2">
      <div className="pointer-events-none absolute top-0 left-0 h-full w-1/3 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-r from-tertiary to-transparent" />
      </div>
      <div className="pointer-events-none absolute top-0 right-0 h-full w-1/2 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-l from-primary to-transparent" />
      </div>
      <h1 className="mb-2 text-headline-xl text-on-primary-container">
        Chào mừng, {MOCK_USER.name}!
      </h1>
      <p className="max-w-md text-body-lg text-on-primary-container/80 opacity-90">
        Hôm nay bạn có {MOCK_USER.newActivitiesCount} hoạt động mới để tích lũy
        điểm thưởng. Cùng nhau xây dựng cộng đồng vững mạnh.
      </p>
    </div>
  );
}
