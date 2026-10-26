import { redirect } from "next/navigation";
import {
  AdminOverview,
  type OverviewAction,
  type OverviewKpi,
  type OverviewTask,
} from "@/components/admin/AdminOverview";
import { ManagerOverview } from "@/components/admin/ManagerOverview";
import { getCurrentAccess } from "@/lib/auth/guard";
import { getSessionUserId } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { fundBalance } from "@/lib/finance/registry";
import { financeAbilities, loadEntries, loadFunds } from "@/lib/finance/server";
import { canViewAllLifeEvents } from "@/lib/life-events/server";
import { paymentAbilities } from "@/lib/payments/server";
import { formatVnd } from "@/lib/visits/registry";
import { visitAbilities } from "@/lib/visits/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const [supabase, userId, viewer] = await Promise.all([createClient(), getSessionUserId(), getCurrentAccess()]);

  if (!userId) {
    redirect("/login?next=/admin");
  }

  if (!viewer) redirect("/login?next=/admin");
  if (!viewer.isAdmin) {
    if (!viewer.isApproved) redirect("/");
    return <ManagerOverview access={viewer} />;
  }

  const access = viewer;
  const db = createServiceClient();
  const canFinance = hasPermission(access, PERMISSIONS.financeView);
  const canPayments = paymentAbilities(access).view;
  const canVisits = visitAbilities(access).view;
  const canLifeEvents = canViewAllLifeEvents(access);
  // Số liệu chỉ để hiển thị trên bảng điều khiển nên dùng count estimated (vẫn chính xác khi số nhỏ)
  const countOnly = { count: "estimated", head: true } as const;
  const noCount = Promise.resolve({ count: 0 });

  // Mọi truy vấn độc lập chạy song song, sau khi đã kiểm tra quyền admin
  const [
    { data: me },
    { count: pendingUsersCount },
    { count: activePollsCount },
    { count: openActivitiesCount },
    { count: pendingFeedbackCount },
    { count: pendingPaymentsCount },
    { count: pendingVisitsCount },
    { count: pendingLifeEventsCount },
    funds,
    entries,
  ] = await Promise.all([
    supabase
      .from(CDILV_TABLE.profiles)
      .select("id, role, approval_status, full_name, employee_code, department, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from(CDILV_TABLE.profiles).select("id", countOnly).eq("approval_status", "pending"),
    supabase.from(CDILV_TABLE.polls).select("id", countOnly).eq("is_active", true).eq("status", "open"),
    supabase.from(CDILV_TABLE.activities).select("id", countOnly).eq("is_registration_open", true),
    supabase.from(CDILV_TABLE.feedbacks).select("id", countOnly).is("admin_reply", null),
    canPayments ? db.from(CDILV_TABLE.paymentRequests).select("id", countOnly).eq("status", "proposed") : noCount,
    canVisits ? db.from(CDILV_TABLE.visitRequests).select("id", countOnly).eq("status", "proposed") : noCount,
    canLifeEvents ? db.from(CDILV_TABLE.lifeEvents).select("id", countOnly).eq("status", "submitted") : noCount,
    canFinance ? loadFunds(db) : Promise.resolve([]),
    canFinance ? loadEntries(db) : Promise.resolve([]),
  ]);

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  const pendingPayments = pendingPaymentsCount ?? 0;
  const pendingVisits = pendingVisitsCount ?? 0;
  const pendingLifeEvents = pendingLifeEventsCount ?? 0;
  const activeFunds = funds.filter((f) => f.is_active);
  const balanceOf = (kinds: string[]) =>
    activeFunds.filter((f) => kinds.includes(f.kind)).reduce((sum, f) => sum + fundBalance(f, entries), 0);

  const kpis: OverviewKpi[] = [
    {
      label: "Góp ý chờ phản hồi",
      value: pendingFeedbackCount ?? 0,
      icon: "rate_review",
      sub: (pendingFeedbackCount ?? 0) > 0 ? "cần xử lý" : "đã xử lý hết",
      subAlert: (pendingFeedbackCount ?? 0) > 0,
    },
  ];
  if (canPayments || canVisits) {
    kpis.push({
      label: "Đề nghị chờ duyệt",
      value: pendingPayments + pendingVisits,
      icon: "pending_actions",
      sub: `${pendingPayments} thanh toán + ${pendingVisits} thăm hỏi`,
    });
  }
  if (canFinance) {
    kpis.push({
      label: "Tổng các quỹ",
      value: formatVnd(activeFunds.reduce((sum, f) => sum + fundBalance(f, entries), 0)),
      icon: "account_balance_wallet",
      sub: `Tiền mặt ${formatVnd(balanceOf(["cash"]))} + ngân hàng ${formatVnd(balanceOf(["bank"]))}`,
    });
  }

  const tasks: OverviewTask[] = [
    {
      href: "/admin/users",
      count: pendingUsersCount ?? 0,
      text: `${pendingUsersCount ?? 0} tài khoản đăng ký chờ duyệt`,
      emptyText: "Không có tài khoản chờ duyệt",
    },
    {
      href: "/admin/competition/feedback",
      count: pendingFeedbackCount ?? 0,
      text: `${pendingFeedbackCount ?? 0} góp ý chờ phản hồi`,
      emptyText: "Không có góp ý chờ phản hồi",
    },
    ...(canLifeEvents
      ? [
          {
            href: "/admin/administration/life-events",
            count: pendingLifeEvents,
            text: `${pendingLifeEvents} tin báo chờ tiếp nhận`,
            emptyText: "Không có tin báo chờ tiếp nhận",
          },
        ]
      : []),
    ...(canVisits
      ? [
          {
            href: "/admin/administration/visits",
            count: pendingVisits,
            text: `${pendingVisits} đề nghị thăm hỏi chờ duyệt`,
            emptyText: "Không có đề nghị thăm hỏi chờ duyệt",
          },
        ]
      : []),
    ...(canPayments
      ? [
          {
            href: "/admin/administration/payments",
            count: pendingPayments,
            text: `${pendingPayments} đề nghị thanh toán chờ duyệt`,
            emptyText: "Không có đề nghị thanh toán chờ duyệt",
          },
        ]
      : []),
    {
      href: "/admin/activities",
      count: openActivitiesCount ?? 0,
      text: `${openActivitiesCount ?? 0} hoạt động đang mở đăng ký`,
      emptyText: "Không có hoạt động đang mở đăng ký",
      tone: "info",
    },
    {
      href: "/admin/polls",
      count: activePollsCount ?? 0,
      text: `${activePollsCount ?? 0} chương trình bình chọn đang diễn ra`,
      emptyText: "Không có bình chọn đang diễn ra",
      tone: "info",
    },
  ];

  const actions: OverviewAction[] = [
    { href: "/admin/scores", label: "Cộng điểm", icon: "military_tech", allowed: true },
    { href: "/admin/content/posts?new=1", label: "Đăng bài", icon: "edit_note", allowed: hasPermission(access, PERMISSIONS.postsManage) },
    { href: "/admin/finance/ledger", label: "Ghi thu / chi", icon: "account_balance_wallet", allowed: financeAbilities(access).record },
    { href: "/admin/administration/payments/new", label: "Lập đề nghị", icon: "request_quote", allowed: paymentAbilities(access).create },
    { href: "/admin/quiz", label: "Bật trắc nghiệm", icon: "quiz", allowed: true },
    { href: "/admin/popups", label: "Popup mới", icon: "notification_important", allowed: hasPermission(access, PERMISSIONS.popupsManage) },
  ].filter((a) => a.allowed);

  return <AdminOverview actions={actions} kpis={kpis} name={me.full_name || "Quản trị viên"} tasks={tasks} />;
}
