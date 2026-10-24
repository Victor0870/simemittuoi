import { redirect } from "next/navigation";
import { HubPage, type HubTile } from "@/components/admin/HubPage";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompetitionHubPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/competition");

  let pendingFeedback = 0;
  if (access.isAdmin) {
    const supabase = await createClient();
    const { count } = await supabase
      .from(CDILV_TABLE.feedbacks)
      .select("id", { count: "exact", head: true })
      .is("admin_reply", null);
    pendingFeedback = count ?? 0;
  }

  const tiles: (HubTile & { allowed: boolean })[] = [
    {
      href: "/admin/scores",
      title: "Cộng điểm thi đua",
      description: "Cộng / trừ điểm phong trào cho đoàn viên, nhập theo file hoặc mã nhân viên, cập nhật bảng xếp hạng.",
      icon: "military_tech",
      tint: "amber",
      allowed: access.isAdmin,
    },
    {
      href: "/admin/polls",
      title: "Bình chọn",
      description: "Tạo, sửa, mở / đóng chương trình bình chọn và tổng kết trao điểm.",
      icon: "how_to_vote",
      tint: "dusty",
      allowed: hasPermission(access, PERMISSIONS.pollsManage),
    },
    {
      href: "/admin/quiz",
      title: "Trắc nghiệm tuần",
      description: "Ngân hàng câu hỏi, lịch mở thi, tổng kết cộng điểm và bài viết kết quả.",
      icon: "quiz",
      tint: "surface",
      allowed: access.isAdmin,
    },
    {
      href: "/feedback",
      title: "Góp ý & nguyện vọng",
      description: "Tiếp nhận ý kiến, tâm tư và sáng kiến của đoàn viên; Ban Chấp hành phản hồi giải quyết.",
      icon: "rate_review",
      tint: "dusty",
      badge: pendingFeedback > 0 ? `${pendingFeedback} chờ phản hồi` : null,
      allowed: access.isAdmin,
    },
    {
      href: "/leaderboard",
      title: "Bảng xếp hạng",
      description: "Xem bảng xếp hạng điểm thi đua của đoàn viên.",
      icon: "leaderboard",
      tint: "amber",
      allowed: true,
    },
  ];

  return (
    <HubPage
      subtitle="Điểm thi đua, bình chọn và trắc nghiệm"
      tiles={tiles.filter((t) => t.allowed)}
      title="Hoạt động thi đua"
    />
  );
}
