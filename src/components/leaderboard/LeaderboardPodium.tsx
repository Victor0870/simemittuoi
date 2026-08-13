import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { LeaderboardEntry } from "@/lib/mock-data";
import { maskDisplayName } from "@/lib/privacy";

type LeaderboardPodiumProps = {
  entries: LeaderboardEntry[];
  maskIdentity?: boolean;
  /** Trang chủ: bục lớn hơn, không tiêu đề Top 3 / nhãn giải */
  variant?: "default" | "home";
};

type PlaceConfig = {
  place: 1 | 2 | 3;
  label: string;
  medal: string;
  barHeight: string;
  barHeightHome: string;
  barClass: string;
  ringClass: string;
  badgeClass: string;
  orderClass: string;
  avatarDefault: string;
  avatarHome: string;
};

const PLACES: PlaceConfig[] = [
  {
    place: 2,
    label: "Nhì",
    medal: "military_tech",
    barHeight: "h-24 md:h-28",
    barHeightHome: "h-20 md:h-36",
    barClass: "bg-[#C0C7D1] text-[#173A67]",
    ringClass: "border-[#A8B0BC] bg-surface-container-lowest",
    badgeClass: "bg-[#A8B0BC] text-white",
    orderClass: "order-1",
    avatarDefault: "h-16 w-16 md:h-20 md:w-20",
    avatarHome: "h-14 w-14 md:h-28 md:w-28",
  },
  {
    place: 1,
    label: "Nhất",
    medal: "emoji_events",
    barHeight: "h-32 md:h-40",
    barHeightHome: "h-28 md:h-48",
    barClass: "bg-primary text-on-primary",
    ringClass: "border-primary bg-primary-fixed",
    badgeClass: "bg-primary text-on-primary",
    orderClass: "order-2",
    avatarDefault: "h-20 w-20 md:h-24 md:w-24",
    avatarHome: "h-16 w-16 md:h-32 md:w-32",
  },
  {
    place: 3,
    label: "Ba",
    medal: "workspace_premium",
    barHeight: "h-20 md:h-24",
    barHeightHome: "h-16 md:h-32",
    barClass: "bg-[#C47B4A] text-white",
    ringClass: "border-[#C47B4A] bg-[#FFE8D6]",
    badgeClass: "bg-[#C47B4A] text-white",
    orderClass: "order-3",
    avatarDefault: "h-16 w-16 md:h-20 md:w-20",
    avatarHome: "h-14 w-14 md:h-28 md:w-28",
  },
];

function Avatar({
  entry,
  maskIdentity,
  ringClass,
  sizeClass,
}: {
  entry: LeaderboardEntry;
  maskIdentity: boolean;
  ringClass: string;
  sizeClass: string;
}) {
  const initial = entry.name.trim().slice(0, 1) || "?";

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full border-4 ${ringClass} ${sizeClass}`}
    >
      {!maskIdentity && entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={entry.name}
          className="h-full w-full object-cover"
          src={entry.avatarUrl}
        />
      ) : (
        <span className="text-xl font-extrabold text-[#173A67] md:text-2xl">
          {maskIdentity ? `#${entry.rank}` : initial}
        </span>
      )}
    </div>
  );
}

export function LeaderboardPodium({
  entries,
  maskIdentity = false,
  variant = "default",
}: LeaderboardPodiumProps) {
  const isHome = variant === "home";
  const byRank = new Map(entries.map((e) => [e.rank, e]));
  const top3 = [1, 2, 3]
    .map((rank) => byRank.get(rank))
    .filter(Boolean) as LeaderboardEntry[];

  if (top3.length === 0) return null;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-outline-variant bg-gradient-to-b from-primary-fixed via-surface-container-lowest to-surface-container-low pb-0 ${
        isHome
          ? "mb-6 px-3 pt-6 md:px-12 md:pt-12"
          : "mb-8 px-4 pt-8 md:px-8"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,154,118,0.35), transparent 45%), radial-gradient(circle at 80% 10%, rgba(128,203,196,0.3), transparent 40%)",
        }}
      />

      <div
        className={`relative text-center ${isHome ? "mb-6 md:mb-12" : "mb-6"}`}
      >
        <div
          className={`inline-flex items-center font-bold tracking-wide uppercase ${
            isHome
              ? "gap-2 rounded-xl border-2 border-primary bg-white px-3.5 py-1.5 text-sm text-[#173A67] shadow-[0_6px_16px_rgba(255,154,118,0.3)] md:gap-4 md:rounded-2xl md:px-10 md:py-4 md:text-3xl"
              : "mb-2 gap-2 rounded-full bg-surface-container-lowest/80 px-3 py-1 text-xs text-[#173A67]"
          }`}
        >
          <MaterialIcon
            className={
              isHome
                ? "text-xl text-primary md:text-5xl"
                : "text-base text-primary"
            }
            filled
            name="trophy"
          />
          Bục vinh danh
        </div>
        {!isHome ? (
          <>
            <h2 className="text-headline-md font-extrabold text-[#173A67] md:text-3xl">
              Top 3 xuất sắc
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Giải Nhất · Nhì · Ba theo tổng điểm thi đua
            </p>
          </>
        ) : null}
      </div>

      <div
        className={`relative mx-auto flex items-end justify-center ${
          isHome
            ? "max-w-5xl gap-1.5 md:gap-10"
            : "max-w-3xl gap-2 md:gap-6"
        }`}
      >
        {PLACES.map((cfg) => {
          const entry = byRank.get(cfg.place);
          if (!entry) {
            return <div key={cfg.place} className={`flex-1 ${cfg.orderClass}`} />;
          }

          const displayName = maskIdentity
            ? maskDisplayName(entry.name, 7)
            : entry.name;
          const isFirst = cfg.place === 1;

          return (
            <div
              key={cfg.place}
              className={`flex flex-1 flex-col items-center ${cfg.orderClass}`}
            >
              <div
                className={`mb-3 flex flex-col items-center ${
                  isFirst
                    ? isHome
                      ? "-translate-y-3 md:-translate-y-6"
                      : "-translate-y-2 md:-translate-y-4"
                    : ""
                }`}
              >
                <div className="relative mb-2">
                  <Avatar
                    entry={entry}
                    maskIdentity={maskIdentity}
                    ringClass={cfg.ringClass}
                    sizeClass={isHome ? cfg.avatarHome : cfg.avatarDefault}
                  />
                  <span
                    className={`absolute -right-1 -bottom-1 flex items-center justify-center rounded-full font-extrabold shadow ${cfg.badgeClass} ${
                      isHome
                        ? "h-6 w-6 text-[10px] md:h-8 md:w-8 md:text-sm"
                        : "h-7 w-7 text-xs"
                    }`}
                  >
                    {cfg.place}
                  </span>
                </div>

                <MaterialIcon
                  className={`mb-1 ${
                    isFirst
                      ? isHome
                        ? "text-2xl text-primary md:text-5xl"
                        : "text-3xl text-primary"
                      : isHome
                        ? "text-xl text-[#173A67] md:text-4xl"
                        : "text-2xl text-[#173A67]"
                  }`}
                  filled
                  name={cfg.medal}
                />

                <p
                  className={`max-w-[5.5rem] text-center font-extrabold leading-tight text-on-surface md:max-w-[13rem] ${
                    isFirst
                      ? isHome
                        ? "text-xs md:text-xl"
                        : "text-base md:text-lg"
                      : isHome
                        ? "text-[11px] md:text-lg"
                        : "text-sm md:text-base"
                  }`}
                  title={entry.name}
                >
                  {displayName}
                </p>
                {!maskIdentity && entry.department ? (
                  <p
                    className={`mt-0.5 truncate text-center text-on-surface-variant ${
                      isHome
                        ? "max-w-[5.5rem] text-[10px] md:max-w-[13rem] md:text-xs"
                        : "max-w-[9rem] text-[11px] md:max-w-[13rem] md:text-xs"
                    }`}
                  >
                    {entry.department}
                  </p>
                ) : null}
                <p
                  className={`mt-1 font-extrabold text-primary ${
                    isFirst
                      ? isHome
                        ? "text-base md:text-3xl"
                        : "text-xl md:text-2xl"
                      : isHome
                        ? "text-sm md:text-2xl"
                        : "text-lg"
                  }`}
                >
                  {entry.score.toLocaleString("vi-VN")}
                  <span className="ml-1 text-xs font-semibold text-on-surface-variant">
                    điểm
                  </span>
                </p>
              </div>

              <div
                className={`flex w-full flex-col items-center justify-center rounded-t-2xl shadow-inner ${cfg.barClass} ${
                  isHome ? cfg.barHeightHome : cfg.barHeight
                } ${isHome ? "pt-2" : "pt-4"}`}
              >
                {!isHome ? (
                  <span className="text-xs font-bold tracking-widest uppercase opacity-90">
                    {cfg.label}
                  </span>
                ) : null}
                <span
                  className={`font-black opacity-90 ${
                    isHome
                      ? "text-2xl md:text-5xl"
                      : "mt-1 text-3xl md:text-4xl"
                  }`}
                >
                  {cfg.place}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
