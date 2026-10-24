import { AdminScoresManager } from "@/components/admin/AdminScoresManager";
import { loadScoresData } from "./loadScoresData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string | string[] }>;
}) {
  const data = await loadScoresData("/admin/scores");
  const { user } = await searchParams;
  const initialSelectedUserId = typeof user === "string" && user ? user : null;

  return (
    <AdminScoresManager
      activities={data.activities}
      currentAdminName={data.currentAdminName}
      initialSelectedUserId={initialSelectedUserId}
      profiles={data.profiles}
      recentEvents={data.recentEvents}
      view="form"
      whitelist={data.whitelist}
    />
  );
}
