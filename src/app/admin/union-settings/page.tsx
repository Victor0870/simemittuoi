import { redirect } from "next/navigation";
import { UnionSettingsManager, type UnionSettingsTab } from "@/components/admin/UnionSettingsManager";
import { getCurrentAccess } from "@/lib/auth/guard";
import { createServiceClient } from "@/lib/supabase/service";
import {
  loadAssignableUnionMembers,
  loadUnionOfficers,
  loadUnionPositions,
} from "@/lib/union-settings/server";
import { canManageUnionSettings } from "@/lib/union-settings/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UnionSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/union-settings");
  if (!canManageUnionSettings(access)) redirect("/");

  const resolvedParams = searchParams ? await searchParams : {};
  const initialTab: UnionSettingsTab =
    resolvedParams.tab === "chuc-danh" ? "chuc-danh" : "nhan-su";

  const db = createServiceClient();
  const [positions, officers, members] = await Promise.all([
    loadUnionPositions(db),
    loadUnionOfficers(db),
    loadAssignableUnionMembers(db),
  ]);

  return (
    <UnionSettingsManager
      initialOfficers={officers}
      initialPositions={positions}
      initialTab={initialTab}
      members={members}
    />
  );
}
