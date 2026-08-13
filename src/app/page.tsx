import { AppShell } from "@/components/layout/AppShell";
import { ActivitiesSection } from "@/components/home/ActivitiesSection";
import { AnnouncementsSection } from "@/components/home/AnnouncementsSection";
import { GoalProgressCard } from "@/components/home/GoalProgressCard";
import { HeroWelcome } from "@/components/home/HeroWelcome";
import { HomeLeaderboardSection } from "@/components/home/HomeLeaderboardSection";
import { ScoreSummaryCard } from "@/components/home/ScoreSummaryCard";
import { getHomePageData } from "@/lib/data/home";

export default async function HomePage() {
  const data = await getHomePageData();
  const { isGuest } = data;

  return (
    <AppShell activeHref="/">
      <section className="mb-10">
        <HeroWelcome isGuest={isGuest} user={data.user} />
      </section>

      <HomeLeaderboardSection
        entries={data.leaderboard}
        maskIdentity={isGuest}
      />

      <div
        className={`mt-10 grid grid-cols-1 gap-8 ${
          isGuest ? "" : "lg:grid-cols-12"
        }`}
      >
        <div className={`space-y-10 ${isGuest ? "" : "lg:col-span-8"}`}>
          <AnnouncementsSection announcements={data.announcements} />
          <ActivitiesSection activities={data.activities} />
        </div>

        {!isGuest ? (
          <div className="space-y-8 lg:col-span-4">
            <ScoreSummaryCard user={data.user} />
            <GoalProgressCard
              note={data.goal.note}
              progress={data.goal.progress}
              title={data.goal.title}
            />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
