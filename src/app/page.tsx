import { ActivitiesSection } from "@/components/home/ActivitiesSection";
import { AnnouncementsSection } from "@/components/home/AnnouncementsSection";
import { GoalProgressCard } from "@/components/home/GoalProgressCard";
import { HeroWelcome } from "@/components/home/HeroWelcome";
import { HomeLeaderboardSection } from "@/components/home/HomeLeaderboardSection";
import { ScoreSummaryCard } from "@/components/home/ScoreSummaryCard";
import { getHomePageData } from "@/lib/data/home";

export const revalidate = 30;

export default async function HomePage() {
  const data = await getHomePageData();
  const { isGuest } = data;

  return (
    <div className="space-y-10">
      <HeroWelcome isGuest={isGuest} user={data.user} />

      {data.dataSource === "error" ? (
        <p className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-on-error-container">
          Không tải được dữ liệu Supabase
          {data.errorMessage ? `: ${data.errorMessage}` : "."}
        </p>
      ) : null}

      <HomeLeaderboardSection
        entries={data.leaderboard}
        maskIdentity={isGuest}
      />

      <AnnouncementsSection announcements={data.announcements} />
      <ActivitiesSection activities={data.activities} />

      {!isGuest ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ScoreSummaryCard user={data.user} />
          <GoalProgressCard
            note={data.goal.note}
            progress={data.goal.progress}
            title={data.goal.title}
          />
        </div>
      ) : null}
    </div>
  );
}
