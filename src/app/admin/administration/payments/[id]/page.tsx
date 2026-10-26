import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PaymentRequestDetailView } from "@/components/payments/PaymentRequestDetailView";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadCounterparties } from "@/lib/catalogs/server";
import { loadCategories } from "@/lib/finance/server";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { loadPaymentMembers, loadPaymentRequestDetail, paymentAbilities } from "@/lib/payments/server";
import { printLogoUrl } from "@/lib/print/logo";
import { loadPrintLogoPath } from "@/lib/print/logo-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; print?: string }>;
};

export default async function PaymentRequestPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { created, print } = await searchParams;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/admin/administration/payments/${id}`);
  const can = paymentAbilities(access);
  if (!can.view) notFound();

  const db = createServiceClient();
  const [detail, settings, categories] = await Promise.all([
    loadPaymentRequestDetail(db, id),
    loadFormSettings(db),
    loadCategories(db),
  ]);
  if (!detail) notFound();
  const editable = can.create && detail.status === "proposed";
  const [counterparties, members, logoPath] = editable
    ? await Promise.all([
        loadCounterparties(db, { activeOnly: true, includeIds: [detail.counterparty_id] }),
        loadPaymentMembers(db, detail.receiver_member_id),
        loadPrintLogoPath(db),
      ])
    : [[], [], null];

  const missingSigners = [
    !settings.accountantName ? "Kế toán Công đoàn" : null,
    !settings.chairmanName ? "Chủ tịch BCH Công đoàn" : null,
  ].filter(Boolean);

  return (
    <div className="max-w-3xl space-y-4 pb-10">
      <Link
        prefetch={false}
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
        href="/admin/administration/payments"
      >
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        Đề nghị thanh toán
      </Link>
      {created ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <MaterialIcon className="text-[20px]" name="check_circle" />
          <span className="flex-1">
            Đã lập đề nghị {detail.code}. Người có quyền duyệt đã nhận được thông báo.
            {print ? " Giấy đề nghị đang được tải về." : ""}
          </span>
          <a
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
            href={`/api/payments/${detail.id}/print`}
          >
            <MaterialIcon className="text-[16px]" name="print" />
            {print ? "Tải lại" : "Tải giấy đề nghị để in"}
          </a>
        </div>
      ) : null}
      {missingSigners.length ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <MaterialIcon className="text-[20px]" name="warning" />
          Chưa cài họ tên {missingSigners.join(", ")} nên ô chữ ký trên giấy sẽ để trống. Vào Cài đặt biểu mẫu in để nhập.
        </div>
      ) : null}
      <PaymentRequestDetailView
        autoPrint={Boolean(created && print)}
        can={can}
        expenseCategories={categories.filter((c) => c.kind === "expense")}
        members={members}
        slipLogoUrl={printLogoUrl(logoPath)}
        slipSigners={{
          preparerDepartment: settings.preparerDepartment,
          accountantName: settings.accountantName,
          chairmanName: settings.chairmanName,
        }}
        canViewRewards={hasPermission(access, PERMISSIONS.rewardsPayout)}
        canViewVisits={hasPermission(access, PERMISSIONS.visitsView)}
        counterparties={counterparties}
        detail={detail}
        isCreator={detail.created_by === access.userId}
      />
    </div>
  );
}
