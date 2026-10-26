import { redirect } from "next/navigation";
import { HubPage, type HubKpi, type HubTile } from "@/components/admin/HubPage";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { fundBalance } from "@/lib/finance/registry";
import { loadEntries, loadFunds } from "@/lib/finance/server";
import { loadPaymentRequestList } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatVnd } from "@/lib/visits/registry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinanceHubPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/finance");

  const canFinance = hasPermission(access, PERMISSIONS.financeView);
  const canPayments = hasPermission(access, PERMISSIONS.paymentsView);
  const db = createServiceClient();
  const [funds, entries, payments] = await Promise.all([
    canFinance ? loadFunds(db) : Promise.resolve([]),
    canFinance ? loadEntries(db) : Promise.resolve([]),
    canPayments ? loadPaymentRequestList(db) : Promise.resolve([]),
  ]);

  const balanceOf = (kind: "cash" | "bank") =>
    funds.filter((f) => f.is_active && f.kind === kind).reduce((sum, f) => sum + fundBalance(f, entries), 0);

  const kpis: HubKpi[] = [
    ...(canFinance
      ? [
          { label: "Tiền mặt", value: formatVnd(balanceOf("cash")), icon: "payments" },
          { label: "Tiền gửi ngân hàng", value: formatVnd(balanceOf("bank")), icon: "account_balance" },
        ]
      : []),
    ...(canPayments
      ? [
          { label: "Đề nghị chờ duyệt", value: payments.filter((p) => p.status === "proposed").length, icon: "pending_actions" },
          { label: "Đã duyệt chờ chi", value: payments.filter((p) => p.status === "approved").length, icon: "task_alt" },
        ]
      : []),
  ];

  const tiles: (HubTile & { allowed: boolean })[] = [
    {
      href: "/admin/finance/income",
      title: "Tổng hợp thu",
      description: "Tổng hợp các khoản thu theo danh mục (tháng / quý / năm), số dư đầu kỳ kết chuyển từ sổ cũ, nhập và xuất Excel khoản thu.",
      icon: "south_west",
      tint: "dusty",
      allowed: canFinance,
    },
    {
      href: "/admin/finance/expense",
      title: "Tổng hợp chi",
      description: "Tổng hợp các khoản chi theo danh mục (tháng / quý / năm), số dư đầu kỳ kết chuyển từ sổ cũ, nhập và xuất Excel khoản chi.",
      icon: "north_east",
      tint: "dusty",
      allowed: canFinance,
    },
    {
      href: "/admin/finance/ledger",
      title: "Sổ quỹ",
      description: "Số dư quỹ tiền mặt / ngân hàng, phiếu thu – chi, chuyển quỹ, khóa sổ và xuất sổ quỹ Excel.",
      icon: "account_balance_wallet",
      tint: "dusty",
      allowed: canFinance,
    },
    {
      href: "/admin/finance/reports",
      title: "Báo cáo tổng hợp",
      description: "Thu – chi theo danh mục, số dư quỹ, thăm hỏi và đề nghị thanh toán theo tháng / quý / năm, xuất Excel.",
      icon: "monitoring",
      tint: "surface",
      allowed: hasPermission(access, PERMISSIONS.reportsView),
    },
    {
      href: "/admin/finance/catalogs",
      title: "Danh mục thu chi",
      description: "Danh mục thu – chi, danh mục đối tượng và mẫu báo cáo dùng cho sổ quỹ và đề nghị thanh toán.",
      icon: "category",
      tint: "amber",
      allowed: hasPermission(access, PERMISSIONS.catalogsManage),
    },
    {
      href: "/admin/finance/regulations",
      title: "Quy chế chi tiêu",
      description: "Soạn và cập nhật Quy chế chi tiêu theo Chương / Điều (chỉ quản trị và người có quyền quản lý quỹ xem).",
      icon: "gavel",
      tint: "surface",
      allowed: hasPermission(access, PERMISSIONS.financeManage),
    },
  ];

  return (
    <HubPage
      hubKey="finance"
      kpis={kpis}
      subtitle="Sổ quỹ, báo cáo và danh mục thu chi"
      tiles={tiles.filter((t) => t.allowed)}
      title="Tài chính công đoàn"
    />
  );
}
