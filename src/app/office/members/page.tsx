import { redirect } from "next/navigation";
import { OfficeMembersTable } from "@/components/members/OfficeMembersTable";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadMemberProfileSummaries } from "@/lib/members/profile-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OfficeMembersPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/office/members");
  if (!hasPermission(access, PERMISSIONS.membersView)) redirect("/");

  const rows = await loadMemberProfileSummaries(createServiceClient());
  const canExport = hasPermission(access, PERMISSIONS.membersExport);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Hồ sơ đoàn viên</h1>
          <p className="text-sm text-on-surface-variant">
            Tình trạng khai báo hồ sơ của đoàn viên đã được duyệt. Bấm vào tên để xem chi tiết.
          </p>
        </div>
      </div>
      <OfficeMembersTable canExport={canExport} rows={rows} />
    </div>
  );
}
