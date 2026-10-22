import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FundEntryDetailView } from "@/components/finance/FundEntryDetailView";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { financeAbilities, loadCategories, loadEntryDetail, loadFunds, loadLockedThrough } from "@/lib/finance/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function FundEntryPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { created } = await searchParams;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/office/finance/${id}`);
  const can = financeAbilities(access);
  if (!can.view) notFound();

  const db = createServiceClient();
  const [detail, funds, categories, lockedThrough] = await Promise.all([
    loadEntryDetail(db, id),
    loadFunds(db),
    loadCategories(db),
    loadLockedThrough(db),
  ]);
  if (!detail) notFound();

  return (
    <div className="max-w-3xl space-y-4 pb-10">
      <Link
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
        href="/office/finance"
      >
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        Sổ quỹ
      </Link>
      {created ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <MaterialIcon className="text-[20px]" name="check_circle" />
          Đã ghi sổ {detail.code}.
          <Link className="underline" href={`/office/finance/new?kind=${detail.kind}`}>
            Ghi tiếp phiếu khác
          </Link>
        </div>
      ) : null}
      <FundEntryDetailView
        canRecord={can.record}
        canViewPayments={hasPermission(access, PERMISSIONS.paymentsView)}
        categories={categories}
        detail={detail}
        funds={funds}
        lockedThrough={lockedThrough}
      />
    </div>
  );
}
