import { AdminScoresManager } from "@/components/admin/AdminScoresManager";
import { loadScoresData } from "../loadScoresData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminScoresMembersPage() {
  const data = await loadScoresData("/admin/scores/members");

  return (
    <AdminScoresManager
      activities={data.activities}
      currentAdminName={data.currentAdminName}
      profiles={data.profiles}
      recentEvents={data.recentEvents}
      view="members"
      whitelist={data.whitelist}
    />
  );
}
