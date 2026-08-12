import { AppShell } from "@/components/layout/AppShell";
import { ActivitiesSection } from "@/components/home/ActivitiesSection";
import { AnnouncementsSection } from "@/components/home/AnnouncementsSection";
import { GoalProgressCard } from "@/components/home/GoalProgressCard";
import { HeroWelcome } from "@/components/home/HeroWelcome";
import { MiniLeaderboard } from "@/components/home/MiniLeaderboard";
import { ScoreSummaryCard } from "@/components/home/ScoreSummaryCard";
import { getHomePageData } from "@/lib/data/home";

export default async function HomePage() {
  const data = await getHomePageData();

  return (
    <AppShell activeHref="/">
      <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <HeroWelcome user={data.user} />
        <ScoreSummaryCard user={data.user} />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <AnnouncementsSection announcements={data.announcements} />
          <ActivitiesSection activities={data.activities} />
        </div>

        <div className="space-y-8 lg:col-span-4">
          <MiniLeaderboard entries={data.leaderboard} />
          <GoalProgressCard
            note={data.goal.note}
            progress={data.goal.progress}
            title={data.goal.title}
          />
        </div>
      </div>
    </AppShell>
  );
}
