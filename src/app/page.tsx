import { AnnouncementsSection } from "@/components/home/AnnouncementsSection";
import {
  HomeActivities,
  HomeHero,
  HomeLeaderboard,
  HomeSessionProvider,
} from "@/components/home/HomeSession";
import { NewsSection } from "@/components/home/NewsSection";
import { getHomePageData } from "@/lib/data/home";

export const revalidate = 30;

export default async function HomePage() {
  const data = await getHomePageData();

  return (
    <HomeSessionProvider activityIds={data.activities.map((a) => a.id)}>
      <div className="space-y-10">
        <HomeHero />

        {data.dataSource === "error" ? (
          <p className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-on-error-container">
            Không tải được dữ liệu Supabase
            {data.errorMessage ? `: ${data.errorMessage}` : "."}
          </p>
        ) : null}

        <HomeLeaderboard entries={data.leaderboard} />

        <AnnouncementsSection announcements={data.announcements} />
        <NewsSection posts={data.newsPosts} />
        <HomeActivities activities={data.activities} />
      </div>
    </HomeSessionProvider>
  );
}
