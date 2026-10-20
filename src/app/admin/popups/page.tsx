import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPopupsManager } from "@/components/admin/AdminPopupsManager";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Link
              className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md font-semibold text-on-surface-variant transition hover:border-[#173A67] hover:text-[#173A67]"
              href={access.isAdmin ? "/admin" : "/office"}
            >
              <MaterialIcon className="text-[18px] text-[#173A67]" name={access.isAdmin ? "dashboard" : "work"} />
              <span>{access.isAdmin ? "Tổng quan Admin" : "Khu vực quản lý"}</span>
            </Link>
            <span className="flex items-center gap-1.5 rounded-xl bg-[#173A67] px-3 py-1.5 text-label-md font-bold text-white shadow-xs">
              <MaterialIcon className="text-[18px]" name="notification_important" />
              <span>Popup thông báo</span>
            </span>
          </div>
          <h1 className="text-headline-md font-bold text-[#173A67]">Popup thông báo nhanh</h1>
          <p className="text-body-md text-[#27496D]">
            Đăng tin gấp nội dung ngắn, hiện nổi trên màn hình khi đoàn viên mở web. Hẹn giờ hiện và tự tắt khi hết hạn.
          </p>
        </div>
        <Link
          className="rounded-xl border-2 border-[#173A67] px-4 py-2 font-bold text-[#173A67] transition hover:bg-[#173A67] hover:text-white"
          href="/"
        >
          ← Về trang chủ
        </Link>
      </div>

      <AdminPopupsManager memberCount={memberCount ?? 0} popups={popups} />
    </>
  );
}
