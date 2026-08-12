import { AppShell } from "@/components/layout/AppShell";
import { ActivitiesSection } from "@/components/home/ActivitiesSection";
import { AnnouncementsSection } from "@/components/home/AnnouncementsSection";
import { GoalProgressCard } from "@/components/home/GoalProgressCard";
import { HeroWelcome } from "@/components/home/HeroWelcome";
import { MiniLeaderboard } from "@/components/home/MiniLeaderboard";
import { ScoreSummaryCard } from "@/components/home/ScoreSummaryCard";
import {
  MOCK_ACTIVITIES,
  MOCK_ANNOUNCEMENTS,
  MOCK_GOAL,
  MOCK_LEADERBOARD,
} from "@/lib/mock-data";

export default function HomePage() {
  return (
    <AppShell activeHref="/">
      <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <HeroWelcome />
        <ScoreSummaryCard />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <AnnouncementsSection announcements={MOCK_ANNOUNCEMENTS} />
          <ActivitiesSection activities={MOCK_ACTIVITIES} />
        </div>

        <div className="space-y-8 lg:col-span-4">
          <MiniLeaderboard entries={MOCK_LEADERBOARD} />
          <GoalProgressCard
            note={MOCK_GOAL.note}
            progress={MOCK_GOAL.progress}
            title={MOCK_GOAL.title}
          />
        </div>
      </div>
    </AppShell>
  );
}
