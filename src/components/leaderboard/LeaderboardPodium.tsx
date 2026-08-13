import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { LeaderboardEntry } from "@/lib/mock-data";
import { maskDisplayName } from "@/lib/privacy";

type LeaderboardPodiumProps = {
  entries: LeaderboardEntry[];
  maskIdentity?: boolean;
};

type PlaceConfig = {
  place: 1 | 2 | 3;
  label: string;
  medal: string;
  barHeight: string;
  barClass: string;
  ringClass: string;
  badgeClass: string;
  orderClass: string;
};

const PLACES: PlaceConfig[] = [
  {
    place: 2,
    label: "Nhì",
    medal: "military_tech",
    barHeight: "h-24 md:h-28",
    barClass: "bg-[#C0C7D1] text-[#173A67]",
    ringClass: "border-[#A8B0BC] bg-surface-container-lowest",
    badgeClass: "bg-[#A8B0BC] text-white",
    orderClass: "order-1",
  },
  {
    place: 1,
    label: "Nhất",
    medal: "emoji_events",
    barHeight: "h-32 md:h-40",
    barClass: "bg-primary text-on-primary",
    ringClass: "border-primary bg-primary-fixed",
    badgeClass: "bg-primary text-on-primary",
    orderClass: "order-2",
  },
  {
    place: 3,
    label: "Ba",
    medal: "workspace_premium",
    barHeight: "h-20 md:h-24",
    barClass: "bg-[#C47B4A] text-white",
    ringClass: "border-[#C47B4A] bg-[#FFE8D6]",
    badgeClass: "bg-[#C47B4A] text-white",
    orderClass: "order-3",
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
}: LeaderboardPodiumProps) {
  const byRank = new Map(entries.map((e) => [e.rank, e]));
  const top3 = [1, 2, 3]
    .map((rank) => byRank.get(rank))
    .filter(Boolean) as LeaderboardEntry[];

  if (top3.length === 0) return null;

  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl border border-outline-variant bg-gradient-to-b from-primary-fixed via-surface-container-lowest to-surface-container-low px-4 pt-8 pb-0 md:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,154,118,0.35), transparent 45%), radial-gradient(circle at 80% 10%, rgba(128,203,196,0.3), transparent 40%)",
        }}
      />

      <div className="relative mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-surface-container-lowest/80 px-3 py-1 text-xs font-bold tracking-wide text-[#173A67] uppercase">
          <MaterialIcon className="text-base text-primary" filled name="trophy" />
          Bục vinh danh
        </div>
        <h2 className="text-headline-md font-extrabold text-[#173A67] md:text-3xl">
          Top 3 xuất sắc
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Giải Nhất · Nhì · Ba theo tổng điểm thi đua
        </p>
      </div>

      <div className="relative mx-auto flex max-w-3xl items-end justify-center gap-2 md:gap-6">
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
                  isFirst ? "-translate-y-2 md:-translate-y-4" : ""
                }`}
              >
                <div className="relative mb-2">
                  <Avatar
                    entry={entry}
                    maskIdentity={maskIdentity}
                    ringClass={cfg.ringClass}
                    sizeClass={
                      isFirst
                        ? "h-20 w-20 md:h-24 md:w-24"
                        : "h-16 w-16 md:h-20 md:w-20"
                    }
                  />
                  <span
                    className={`absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold shadow ${cfg.badgeClass}`}
                  >
                    {cfg.place}
                  </span>
                </div>

                <MaterialIcon
                  className={`mb-1 ${
                    isFirst ? "text-3xl text-primary" : "text-2xl text-[#173A67]"
                  }`}
                  filled
                  name={cfg.medal}
                />

                <p
                  className={`max-w-[9rem] text-center font-extrabold text-on-surface md:max-w-[11rem] ${
                    isFirst ? "text-base md:text-lg" : "text-sm md:text-base"
                  }`}
                  title={entry.name}
                >
                  {displayName}
                </p>
                {!maskIdentity && entry.department ? (
                  <p className="mt-0.5 max-w-[9rem] truncate text-center text-[11px] text-on-surface-variant md:max-w-[11rem]">
                    {entry.department}
                  </p>
                ) : null}
                <p
                  className={`mt-1 font-extrabold text-primary ${
                    isFirst ? "text-xl md:text-2xl" : "text-lg"
                  }`}
                >
                  {entry.score.toLocaleString("vi-VN")}
                  <span className="ml-1 text-xs font-semibold text-on-surface-variant">
                    điểm
                  </span>
                </p>
              </div>

              <div
                className={`flex w-full flex-col items-center justify-start rounded-t-2xl pt-4 shadow-inner ${cfg.barClass} ${cfg.barHeight}`}
              >
                <span className="text-xs font-bold tracking-widest uppercase opacity-90">
                  {cfg.label}
                </span>
                <span className="mt-1 text-3xl font-black opacity-90 md:text-4xl">
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
