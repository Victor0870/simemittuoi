import { AdminScoresManager } from "@/components/admin/AdminScoresManager";
import { resolveHistoryFrom } from "@/components/admin/scoreHistoryRange";
import { todayInVietnam } from "@/lib/life-events/registry";
import { loadScoresData } from "../loadScoresData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminScoresHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  const today = todayInVietnam();
  const historyFrom = resolveHistoryFrom(from, today);
  const data = await loadScoresData("/admin/scores/history", { historyFrom });

  return (
    <AdminScoresManager
      activities={data.activities}
      currentAdminName={data.currentAdminName}
      historyCapped={data.historyCapped}
      historyFrom={historyFrom}
      historyToday={today}
      profiles={data.profiles}
      recentEvents={data.recentEvents}
      view="history"
      whitelist={data.whitelist}
    />
  );
}
