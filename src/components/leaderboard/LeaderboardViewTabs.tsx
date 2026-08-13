import Link from "next/link";

export type LeaderboardTab = "10" | "45";

type LeaderboardViewTabsProps = {
  active: LeaderboardTab;
};

const TABS: Array<{ id: LeaderboardTab; label: string }> = [
  { id: "10", label: "Top 10" },
  { id: "45", label: "Top 45" },
];

export function LeaderboardViewTabs({ active }: LeaderboardViewTabsProps) {
  return (
    <div className="inline-flex rounded-xl border border-outline-variant bg-surface-container-low p-1">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
              isActive
                ? "bg-tertiary text-on-tertiary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
            href={`/leaderboard?tab=${tab.id}`}
            scroll={false}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
