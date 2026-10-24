import { redirect } from "next/navigation";
import { HubPage, type HubTile } from "@/components/admin/HubPage";
import { getCurrentAccess } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SystemHubPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/system");

  const tiles: (HubTile & { allowed: boolean })[] = [
    {
      href: "/admin/roles",
      title: "Phân quyền theo cấp",
      description: "Tạo cấp (Manager, Kế toán, Ủy viên…), chọn quyền cho từng cấp và gán thành viên.",
      icon: "admin_panel_settings",
      tint: "amber",
      allowed: access.isAdmin,
    },
    {
      href: "/settings",
      title: "Cài đặt tài khoản",
      description: "Cập nhật ảnh đại diện, thông tin cá nhân và mật khẩu của bạn.",
      icon: "person",
      tint: "dusty",
      allowed: true,
    },
  ];

  return (
    <HubPage
      hubKey="system"
      subtitle="Phân quyền và cài đặt tài khoản"
      tiles={tiles.filter((t) => t.allowed)}
      title="Hệ thống"
    />
  );
}
