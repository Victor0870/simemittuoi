import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { LeaderboardEntry } from "@/lib/mock-data";
import { maskDisplayName } from "@/lib/privacy";

type LeaderboardPodiumProps = {
  entries: LeaderboardEntry[];
  maskIdentity?: boolean;
  /** Trang chủ: bục lớn hơn, không tiêu đề Top 3 / nhãn giải */
  variant?: "default" | "home";
  onSelectMember?: (entry: LeaderboardEntry) => void;
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
    label: "Á quân",
    medal: "workspace_premium",
    barHeight: "h-24 md:h-28",
    barHeightHome: "h-32 sm:h-40",
    barClass:
      "bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 border-t-4 border-slate-400 text-slate-500",
    ringClass: "ring-4 ring-slate-300 bg-slate-100",
    badgeClass: "bg-slate-200 text-slate-700 border border-slate-300",
    orderClass: "order-1",
    avatarDefault: "h-16 w-16 md:h-20 md:w-20",
    avatarHome: "h-16 w-16 sm:h-20 sm:w-20",
  },
  {
    place: 1,
    label: "Quán quân",
    medal: "crown",
    barHeight: "h-32 md:h-40",
    barHeightHome: "h-44 sm:h-52",
    barClass:
      "bg-gradient-to-b from-amber-300 via-amber-200 to-amber-300 border-t-4 border-amber-500 text-amber-800 shadow-lg",
    ringClass: "ring-4 ring-amber-400 ring-offset-2 bg-gradient-to-br from-amber-100 to-amber-200",
    badgeClass:
      "bg-gradient-to-r from-amber-400 to-amber-500 text-white border border-amber-300 shadow-md",
    orderClass: "order-2",
    avatarDefault: "h-20 w-20 md:h-24 md:w-24",
    avatarHome: "h-20 w-20 sm:h-24 sm:w-24",
  },
  {
    place: 3,
    label: "",
    medal: "military_tech",
    barHeight: "h-20 md:h-24",
    barHeightHome: "h-24 sm:h-32",
    barClass:
      "bg-gradient-to-b from-amber-600/30 via-amber-700/20 to-amber-600/30 border-t-4 border-amber-700 text-amber-800",
    ringClass: "ring-4 ring-amber-700/40 bg-amber-50",
    badgeClass: "bg-amber-100 text-amber-900 border border-amber-300",
    orderClass: "order-3",
    avatarDefault: "h-16 w-16 md:h-20 md:w-20",
    avatarHome: "h-16 w-16 sm:h-20 sm:w-20",
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
      className={`flex items-center justify-center overflow-hidden rounded-full shadow-md ${ringClass} ${sizeClass}`}
    >
      {!maskIdentity && entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={entry.name}
          className="h-full w-full object-cover"
          src={entry.avatarUrl}
        />
      ) : (
        <span className="text-xl font-extrabold text-primary md:text-2xl">
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
  onSelectMember,
}: LeaderboardPodiumProps) {
  const isHome = variant === "home";
  const byRank = new Map(entries.map((e) => [e.rank, e]));
  const top3 = [1, 2, 3]
    .map((rank) => byRank.get(rank))
    .filter(Boolean) as LeaderboardEntry[];

  if (top3.length === 0) return null;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-dusty-border/80 bg-surface-container-lowest shadow-sm ${
        isHome ? "mb-0 px-6 pt-6 pb-2 sm:px-8 sm:pt-8" : "mb-8 px-4 pt-8 md:px-8"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_55%)] opacity-70" />

      <div
        className={`relative z-10 ${isHome ? "mb-8 flex items-center justify-between" : "mb-6 text-center"}`}
      >
        <div
          className={`inline-flex items-center gap-1.5 font-bold tracking-wide uppercase ${
            isHome
              ? "rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-label-sm text-amber-800"
              : "mb-2 gap-2 rounded-full bg-white/80 px-3 py-1 text-xs text-primary"
          }`}
        >
          <MaterialIcon
            className={isHome ? "text-[16px] text-amber-honor" : "text-base text-primary"}
            filled
            name="emoji_events"
          />
          {isHome ? "TOP 3 CHIẾN SĨ THI ĐUA" : "Bục vinh danh"}
        </div>
        {isHome ? (
          <span className="hidden text-body-sm text-on-surface-variant italic sm:inline">
            Điểm phong trào tích lũy
          </span>
        ) : (
          <>
            <h2 className="text-headline-md font-extrabold text-primary md:text-3xl">
              Top 3 xuất sắc
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Giải Nhất · Nhì · Ba theo tổng điểm thi đua (bấm vào để xem lịch sử điểm)
            </p>
          </>
        )}
      </div>

      <div
        className={`relative z-10 mx-auto grid grid-cols-3 items-end ${
          isHome ? "gap-2 pt-12 sm:gap-4 sm:pt-16" : "max-w-3xl gap-2 md:gap-6"
        }`}
      >
        {PLACES.map((cfg) => {
          const entry = byRank.get(cfg.place);
          if (!entry) {
            return <div key={cfg.place} className={cfg.orderClass} />;
          }

          const displayName = maskIdentity
            ? maskDisplayName(entry.name, 7)
            : entry.name;
          const isFirst = cfg.place === 1;

          return (
            <div
              key={cfg.place}
              className={`group flex flex-col items-center text-center ${cfg.orderClass} ${
                isFirst && isHome ? "-mt-8" : ""
              }`}
            >
              <div
                onClick={onSelectMember ? () => onSelectMember(entry) : undefined}
                className={`mb-3 flex flex-col items-center ${
                  onSelectMember ? "cursor-pointer group/podium" : ""
                }`}
                title="Bấm để xem lịch sử cộng điểm"
                role={onSelectMember ? "button" : undefined}
                tabIndex={onSelectMember ? 0 : undefined}
                onKeyDown={
                  onSelectMember
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectMember(entry);
                        }
                      }
                    : undefined
                }
              >
                <div
                  className={`relative mb-3 transition-transform duration-200 ${
                    isFirst ? "group-hover:-translate-y-2" : "group-hover:-translate-y-1"
                  }`}
                >
                  {isFirst && isHome ? (
                    <div className="pointer-events-none absolute -top-9 inset-x-0 z-10 flex justify-center sm:-top-10">
                      <MaterialIcon
                        className="animate-bounce text-amber-500 drop-shadow-[0_2px_3px_rgba(180,83,9,0.45)]"
                        filled
                        name="crown"
                        size={32}
                      />
                    </div>
                  ) : null}
                  <Avatar
                    entry={entry}
                    maskIdentity={maskIdentity}
                    ringClass={cfg.ringClass}
                    sizeClass={isHome ? cfg.avatarHome : cfg.avatarDefault}
                  />
                  <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-label-sm font-bold shadow-xs ${cfg.badgeClass}`}
                    >
                      #{cfg.place}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-center gap-1 group-hover/podium:text-primary transition-colors">
                  <h3
                    className={`line-clamp-1 font-bold text-on-surface group-hover/podium:text-primary ${
                      isFirst ? "text-headline-sm" : "text-body-md"
                    }`}
                    title={entry.name}
                  >
                    {displayName}
                  </h3>
                  <MaterialIcon
                    className="text-[14px] text-amber-honor opacity-80 group-hover/podium:opacity-100 group-hover/podium:scale-110 transition-all"
                    name="history_edu"
                  />
                </div>
                <div className="my-1 inline-flex items-center gap-1">
                  <span
                    className={`font-extrabold text-primary ${
                      isFirst ? "text-headline-md" : "text-headline-sm"
                    }`}
                  >
                    {entry.score.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-body-sm font-medium text-on-surface-variant">
                    điểm
                  </span>
                </div>
                {cfg.label ? (
                  <div
                    className={`mb-3 rounded px-2 py-0.5 text-[11px] font-semibold ${
                      isFirst
                        ? "rounded-full border border-amber-300 bg-amber-light text-amber-900"
                        : "border border-dusty-border bg-dusty-light text-primary"
                    }`}
                  >
                    {cfg.label}
                  </div>
                ) : (
                  <div className="mb-3 h-[21px]" />
                )}
              </div>

              <div
                className={`flex w-full flex-col items-center justify-center rounded-t-xl shadow-inner ${cfg.barClass} ${
                  isHome ? cfg.barHeightHome : cfg.barHeight
                }`}
              >
                <span
                  className={`font-black opacity-80 ${
                    isHome ? "text-headline-xl" : "text-3xl md:text-4xl"
                  }`}
                >
                  {cfg.place}
                </span>
                <span className="min-h-[16px] text-[11px] font-bold tracking-widest uppercase opacity-80">
                  {cfg.place === 1 ? "QUÁN QUÂN" : cfg.place === 2 ? "Á QUÂN" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
