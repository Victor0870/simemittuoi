import { redirect } from "next/navigation";
import { HubPage, type HubTile } from "@/components/admin/HubPage";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission, visibleAdminLinks } from "@/lib/auth/permissions";
import { canManageUnionSettings } from "@/lib/union-settings/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdministrationHubPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/administration");

  const tiles: (HubTile & { allowed: boolean })[] = [
    {
      href: "/admin/administration/life-events",
      title: "Hộp tin báo",
      description: "Tin vui, tin ốm, khó khăn đoàn viên gửi lên: xem giấy tờ, tiếp nhận, ghi chú.",
      icon: "campaign",
      tint: "amber",
      allowed: hasPermission(access, PERMISSIONS.lifeEventsView),
    },
    {
      href: "/admin/administration/visits",
      title: "Đề nghị thăm hỏi",
      description: "Lập đề nghị thăm hỏi từ tin báo, duyệt, xác nhận đã chi và in phiếu thăm hỏi theo mẫu C11-TLĐ.",
      icon: "volunteer_activism",
      tint: "dusty",
      allowed: hasPermission(access, PERMISSIONS.visitsView),
    },
    {
      href: "/admin/administration/payments",
      title: "Đề nghị thanh toán",
      description: "Lập giấy đề nghị thanh toán, duyệt, xác nhận đã chi và tải phiếu theo mẫu.",
      icon: "request_quote",
      tint: "dusty",
      allowed: hasPermission(access, PERMISSIONS.paymentsView),
    },
    {
      href: "/admin/administration/rewards",
      title: "Thanh toán thưởng",
      description: "Chọn chương trình đã kết thúc để xem danh sách nhận thưởng riêng: số tài khoản, số tiền, in và xuất Excel.",
      icon: "payments",
      tint: "surface",
      allowed: hasPermission(access, PERMISSIONS.rewardsPayout),
    },
    {
      href: "/admin/administration/gifts/children",
      title: "Quà thiếu nhi",
      description: "Lọc con đoàn viên dưới 16 tuổi theo mốc ngày, in danh sách ký nhận và xuất Excel.",
      icon: "redeem",
      tint: "amber",
      allowed: hasPermission(access, PERMISSIONS.giftsChildren),
    },
    {
      href: "/admin/administration/print-settings",
      title: "Cài đặt biểu mẫu in",
      description: "Tên đơn vị, người ký trên phiếu in và mức chi thăm hỏi mặc định.",
      icon: "print",
      tint: "surface",
      allowed: hasPermission(access, PERMISSIONS.formsSettings),
    },
    {
      href: "/admin/union-settings",
      title: "Cài đặt công đoàn",
      description: "Danh sách cán bộ công đoàn, chức danh và nhiệm kỳ dùng trong văn bản, biên bản họp.",
      icon: "badge",
      tint: "dusty",
      allowed: canManageUnionSettings(access),
    },
  ];

  return (
    <HubPage
      hubKey="administration"
      subtitle="Tin báo, thăm hỏi, đề nghị thanh toán, thưởng và biểu mẫu"
      tiles={visibleAdminLinks(access, tiles)}
      title="Quản lý hành chính"
    />
  );
}
