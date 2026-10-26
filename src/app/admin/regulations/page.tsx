import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegulationAdminView } from "@/components/admin/RegulationAdminView";
import { getCurrentAccess } from "@/lib/auth/guard";
import { BRAND } from "@/lib/brand";
import { getRegulationDocumentWithSections } from "@/lib/regulations/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Quy chế chi tiêu | ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default async function AdminRegulationsPage() {
  const access = await getCurrentAccess();
  if (!access) {
    redirect("/login?next=/admin/regulations");
  }

  // Trang chỉ dành riêng cho Quản trị viên (admin only)
  if (!access.isAdmin) {
    redirect("/");
  }

  const data = await getRegulationDocumentWithSections(2026);
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <h2 className="text-lg font-bold text-slate-700">Chưa tìm thấy Quy chế chi tiêu 2026</h2>
        <p className="mt-1 text-sm text-slate-500">Vui lòng kiểm tra lại dữ liệu trong hệ thống.</p>
      </div>
    );
  }

  return <RegulationAdminView initialData={data} />;
}
