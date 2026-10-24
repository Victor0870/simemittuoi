import { redirect } from "next/navigation";
import {
  AdminOverview,
  type OverviewAction,
  type OverviewKpi,
  type OverviewTask,
} from "@/components/admin/AdminOverview";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { fundBalance } from "@/lib/finance/registry";
import { financeAbilities, loadEntries, loadFunds } from "@/lib/finance/server";
import { canViewAllLifeEvents, loadLifeEventList } from "@/lib/life-events/server";
import { loadPaymentRequestList, paymentAbilities } from "@/lib/payments/server";
import { formatVnd } from "@/lib/visits/registry";
import { loadVisitRequestList, visitAbilities } from "@/lib/visits/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: me } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("id, role, approval_status, full_name, employee_code, department, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  // Fetch quick metrics for admin dashboard
  const [
    { count: pendingUsersCount },
    { count: totalUsersCount },
    { count: totalPollsCount },
    { count: activePollsCount },
    { count: totalActivitiesCount },
    { count: openActivitiesCount },
    { count: pendingFeedbackCount },
    { count: activeWhitelistCount },
    { count: quizQuestionsCount },
    { count: activePopupsCount },
  ] = await Promise.all([
    supabase
      .from(CDILV_TABLE.profiles)
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending"),
    supabase
      .from(CDILV_TABLE.profiles)
      .select("id", { count: "exact", head: true }),
    supabase
      .from(CDILV_TABLE.polls)
      .select("id", { count: "exact", head: true }),
    supabase
      .from(CDILV_TABLE.polls)
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "open"),
    supabase
      .from(CDILV_TABLE.activities)
      .select("id", { count: "exact", head: true }),
    supabase
      .from(CDILV_TABLE.activities)
      .select("id", { count: "exact", head: true })
      .eq("is_registration_open", true),
    supabase
      .from(CDILV_TABLE.feedbacks)
      .select("id", { count: "exact", head: true })
      .is("admin_reply", null),
    supabase
      .from(CDILV_TABLE.employeeWhitelist)
      .select("employee_code", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from(CDILV_TABLE.quizQuestions)
      .select("id", { count: "exact", head: true }),
    createServiceClient()
      .from(CDILV_TABLE.popups)
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`),
  ]);

  const access = await getCurrentAccess();
  const db = createServiceClient();
  const canFinance = access ? hasPermission(access, PERMISSIONS.financeView) : false;
  const canPayments = access ? paymentAbilities(access).view : false;
  const canVisits = access ? visitAbilities(access).view : false;
  const canLifeEvents = access ? canViewAllLifeEvents(access) : false;
  const [funds, entries, payments, visits, lifeEvents] = await Promise.all([
    canFinance ? loadFunds(db) : Promise.resolve([]),
    canFinance ? loadEntries(db) : Promise.resolve([]),
    canPayments ? loadPaymentRequestList(db) : Promise.resolve([]),
    canVisits ? loadVisitRequestList(db) : Promise.resolve([]),
    canLifeEvents ? loadLifeEventList(db, null) : Promise.resolve([]),
  ]);

  const pendingPayments = payments.filter((p) => p.status === "proposed").length;
  const pendingVisits = visits.filter((v) => v.status === "proposed").length;
  const pendingLifeEvents = lifeEvents.filter((e) => e.status === "submitted").length;
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
      href: "/feedback",
      count: pendingFeedbackCount ?? 0,
      text: `${pendingFeedbackCount ?? 0} góp ý chờ phản hồi`,
      emptyText: "Không có góp ý chờ phản hồi",
    },
    ...(canLifeEvents
      ? [
          {
            href: "/office/life-events",
            count: pendingLifeEvents,
            text: `${pendingLifeEvents} tin báo chờ tiếp nhận`,
            emptyText: "Không có tin báo chờ tiếp nhận",
          },
        ]
      : []),
    ...(canVisits
      ? [
          {
            href: "/office/visits",
            count: pendingVisits,
            text: `${pendingVisits} đề nghị thăm hỏi chờ duyệt`,
            emptyText: "Không có đề nghị thăm hỏi chờ duyệt",
          },
        ]
      : []),
    ...(canPayments
      ? [
          {
            href: "/office/payments",
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
    { href: "/posts", label: "Đăng bài", icon: "edit_note", allowed: access ? hasPermission(access, PERMISSIONS.postsManage) : false },
    { href: "/office/finance", label: "Ghi thu / chi", icon: "account_balance_wallet", allowed: access ? financeAbilities(access).record : false },
    { href: "/office/payments/new", label: "Lập đề nghị", icon: "request_quote", allowed: access ? paymentAbilities(access).create : false },
    { href: "/admin/quiz", label: "Bật trắc nghiệm", icon: "quiz", allowed: true },
    { href: "/admin/popups", label: "Popup mới", icon: "notification_important", allowed: access ? hasPermission(access, PERMISSIONS.popupsManage) : false },
  ].filter((a) => a.allowed);

  return <AdminOverview actions={actions} kpis={kpis} name={me.full_name || "Quản trị viên"} tasks={tasks} />;
}
