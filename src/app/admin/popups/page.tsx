import { redirect } from "next/navigation";
import { AdminPopupsManager } from "@/components/admin/AdminPopupsManager";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { getAdminPopups } from "@/lib/data/popups";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPopupsPage() {
  const access = await getCurrentAccess();
  if (!access) {
    redirect("/login?next=/admin/popups");
  }
  if (!hasPermission(access, PERMISSIONS.popupsManage)) {
    redirect("/");
  }

  const [popups, { count: memberCount }] = await Promise.all([
    getAdminPopups(),
    createServiceClient()
      .from(CDILV_TABLE.profiles)
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "approved"),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-bold text-[#173A67]">Popup thông báo nhanh</h1>
          <p className="text-body-md text-[#27496D]">
            Đăng tin gấp nội dung ngắn, hiện nổi trên màn hình khi đoàn viên mở web. Hẹn giờ hiện và tự tắt khi hết hạn.
          </p>
        </div>
      </div>

      <AdminPopupsManager memberCount={memberCount ?? 0} popups={popups} />
    </>
  );
}
