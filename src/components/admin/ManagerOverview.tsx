import {
  AdminOverview,
  type OverviewAction,
  type OverviewKpi,
  type OverviewTask,
} from "@/components/admin/AdminOverview";
import type { CurrentAccess } from "@/lib/auth/guard";
import { OFFICE_TOOLS, PERMISSIONS, hasPermission, visibleAdminLinks } from "@/lib/auth/permissions";
import { fundBalance } from "@/lib/finance/registry";
import { financeAbilities, loadEntries, loadFunds } from "@/lib/finance/server";
import { canViewAllLifeEvents, loadLifeEventList } from "@/lib/life-events/server";
import { loadPaymentRequestList, paymentAbilities } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatVnd } from "@/lib/visits/registry";
import { loadVisitRequestList, visitAbilities } from "@/lib/visits/server";

/** Trang tổng quan /admin cho cấp quản lý (không phải admin): chỉ công cụ, số liệu và việc cần làm theo quyền. */
export async function ManagerOverview({ access }: { access: CurrentAccess }) {
  const tools = visibleAdminLinks(
    access,
    OFFICE_TOOLS.map((tool) => ({ ...tool, allowed: hasPermission(access, tool.permission) })),
  );
  const canFinance = hasPermission(access, PERMISSIONS.financeView);
  const canPayments = paymentAbilities(access).view;
  const canVisits = visitAbilities(access).view;
  const canLifeEvents = canViewAllLifeEvents(access);

  const db = createServiceClient();
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

  const kpis: OverviewKpi[] = [];
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

  const tasks: OverviewTask[] = [];
  if (canLifeEvents) {
    tasks.push({
      href: "/admin/administration/life-events",
      count: pendingLifeEvents,
      text: `${pendingLifeEvents} tin báo chờ tiếp nhận`,
      emptyText: "Không có tin báo chờ tiếp nhận",
    });
  }
  if (canVisits) {
    tasks.push({
      href: "/admin/administration/visits",
      count: pendingVisits,
      text: `${pendingVisits} đề nghị thăm hỏi chờ duyệt`,
      emptyText: "Không có đề nghị thăm hỏi chờ duyệt",
    });
  }
  if (canPayments) {
    tasks.push({
      href: "/admin/administration/payments",
      count: pendingPayments,
      text: `${pendingPayments} đề nghị thanh toán chờ duyệt`,
      emptyText: "Không có đề nghị thanh toán chờ duyệt",
    });
  }

  const actions: OverviewAction[] = visibleAdminLinks(access, [
    { href: "/posts", label: "Đăng bài", icon: "edit_note", allowed: hasPermission(access, PERMISSIONS.postsManage) },
    { href: "/admin/finance/ledger", label: "Ghi thu / chi", icon: "account_balance_wallet", allowed: financeAbilities(access).record },
    { href: "/admin/administration/payments/new", label: "Lập đề nghị", icon: "request_quote", allowed: paymentAbilities(access).create },
    { href: "/admin/popups", label: "Popup mới", icon: "notification_important", allowed: hasPermission(access, PERMISSIONS.popupsManage) },
  ]);

  if (tools.length === 0) {
    return (
      <div className="space-y-6 pb-10">
        <AdminOverview actions={[]} kpis={[]} tasks={[]} />
        <div className="rounded-2xl border border-border-subtle bg-white p-6 text-center text-on-surface-variant">
          Bạn chưa được phân quyền sử dụng công cụ quản lý nào. Vui lòng liên hệ Quản trị viên.
        </div>
      </div>
    );
  }

  return (
    <AdminOverview
      actions={actions}
      kpis={kpis}
      tasks={tasks}
      tiles={tools.map((tool) => ({
        href: tool.href,
        title: tool.title,
        description: tool.description,
        icon: tool.icon,
        tint: "dusty" as const,
      }))}
    />
  );
}
