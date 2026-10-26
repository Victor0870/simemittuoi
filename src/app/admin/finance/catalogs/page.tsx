import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryCatalog } from "@/components/catalogs/CategoryCatalog";
import { CounterpartyCatalog } from "@/components/catalogs/CounterpartyCatalog";
import { ReportTemplateManager } from "@/components/catalogs/ReportTemplateManager";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadCounterparties } from "@/lib/catalogs/server";
import { loadCategories } from "@/lib/finance/server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { loadReportTemplate } from "@/lib/report-templates/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "counterparties", label: "Đối tượng", icon: "apartment" },
  { key: "income", label: "Danh mục thu", icon: "south_west" },
  { key: "expense", label: "Danh mục chi", icon: "north_east" },
  { key: "templates", label: "Mẫu báo cáo", icon: "description" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
type PageProps = { searchParams: Promise<{ tab?: string }> };

export default async function CatalogsPage({ searchParams }: PageProps) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "counterparties";
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/admin/finance/catalogs?tab=${tab}`);
  if (!hasPermission(access, PERMISSIONS.catalogsManage)) redirect("/admin");

  const db = createServiceClient();
  const [categories, counterparties, template] = await Promise.all([
    tab === "counterparties" ? Promise.resolve([]) : loadCategories(db),
    tab === "counterparties" ? loadCounterparties(db) : Promise.resolve([]),
    tab === "counterparties" ? Promise.resolve(null) : loadReportTemplate(db),
  ]);
  const active = template?.active ?? null;

  return (
    <div className="max-w-4xl space-y-4 pb-10">
      <div>
        <h1 className="text-headline-md font-extrabold text-[#173A67]">Quản lý danh mục</h1>
        <p className="text-sm text-on-surface-variant">
          Danh mục đối tượng (công ty, cá nhân nhận / nộp tiền) và danh mục phân loại thu – chi dùng cho sổ quỹ, đề nghị thanh toán và báo
          cáo. Không xóa mục đã dùng – chỉ ẩn để giữ đúng chứng từ cũ.
        </p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-bold ${
              t.key === tab
                ? "bg-[#173A67] text-white"
                : "border border-outline-variant bg-white text-on-surface-variant hover:border-[#173A67]"
            }`}
            href={`/admin/finance/catalogs?tab=${t.key}`}
          >
            <MaterialIcon className="text-[18px]" name={t.icon} />
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "counterparties" ? (
        <CounterpartyCatalog counterparties={counterparties} />
      ) : tab === "templates" ? (
        <ReportTemplateManager canEdit={access.isAdmin} categories={categories} template={template} today={todayInVietnam()} />
      ) : (
        <CategoryCatalog
          categories={categories}
          kind={tab}
          templateLines={active?.lines ?? []}
          templateName={active ? `${active.title} – phiên bản ${active.version}` : null}
        />
      )}
    </div>
  );
}
