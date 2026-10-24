import { AdminScoresManager } from "@/components/admin/AdminScoresManager";
import { loadScoresData } from "../loadScoresData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminScoresHistoryPage() {
  const data = await loadScoresData("/admin/scores/history");

  return (
    <AdminScoresManager
      activities={data.activities}
      currentAdminName={data.currentAdminName}
      profiles={data.profiles}
      recentEvents={data.recentEvents}
      view="history"
      whitelist={data.whitelist}
    />
  );
}
