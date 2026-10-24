import { redirect } from "next/navigation";
import { HubPage, type HubTile } from "@/components/admin/HubPage";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ContentHubPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/content");

  const tiles: (HubTile & { allowed: boolean })[] = [
    {
      href: "/posts",
      title: "Bài viết",
      description: "Đăng bài viết mới, sửa bài, đánh dấu thông báo quan trọng, ẩn / hiện bài.",
      icon: "newspaper",
      tint: "dusty",
      allowed: hasPermission(access, PERMISSIONS.postsManage),
    },
    {
      href: "/admin/activities",
      title: "Hoạt động & phong trào",
      description: "Tạo hoạt động, phát động phong trào, mở / dừng nhận đăng ký và theo dõi danh sách tham gia.",
      icon: "event_available",
      tint: "surface",
      allowed: access.isAdmin,
    },
    {
      href: "/albums",
      title: "Album ảnh",
      description: "Tạo album, cài đặt thời gian và điểm thưởng đăng ảnh, kiểm duyệt ảnh và bình luận.",
      icon: "photo_library",
      tint: "dusty",
      allowed: hasPermission(access, PERMISSIONS.albumsManage),
    },
    {
      href: "/admin/popups",
      title: "Popup thông báo",
      description: "Đăng tin gấp nội dung ngắn hiện dạng popup, hẹn giờ hiện và hết hạn, xem số người đã xem.",
      icon: "notification_important",
      tint: "amber",
      allowed: hasPermission(access, PERMISSIONS.popupsManage),
    },
  ];

  return (
    <HubPage
      hubKey="content"
      subtitle="Bài viết, hoạt động, album ảnh và thông báo"
      tiles={tiles.filter((t) => t.allowed)}
      title="Quản lý nội dung"
    />
  );
}
