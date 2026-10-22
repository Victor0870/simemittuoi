import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VisitRequestDetailView } from "@/components/visits/VisitRequestDetailView";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { loadPaymentForVisit } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadVisitRequestDetail, visitAbilities } from "@/lib/visits/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function VisitRequestPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { created } = await searchParams;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/office/visits/${id}`);
  const can = visitAbilities(access);
  if (!can.view) notFound();

  const db = createServiceClient();
  const [detail, settings, payment] = await Promise.all([
    loadVisitRequestDetail(db, id),
    loadFormSettings(db),
    loadPaymentForVisit(db, id),
  ]);
  if (!detail) notFound();

  return (
    <div className="max-w-3xl space-y-4 pb-10">
      <Link
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
        href="/office/visits"
      >
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        Đề nghị thăm hỏi
      </Link>
      {created ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <MaterialIcon className="text-[20px]" name="check_circle" />
          Đã lập đề nghị {detail.code}. Người có quyền duyệt đã nhận được thông báo.
        </div>
      ) : null}
      {!settings.chairmanName ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <MaterialIcon className="text-[20px]" name="warning" />
          Chưa cài họ tên Chủ tịch Công đoàn nên ô chữ ký trên phiếu sẽ để trống. Vào Cài đặt biểu mẫu in để nhập.
        </div>
      ) : null}
      <VisitRequestDetailView
        can={can}
        defaultAmounts={settings.visitAmounts}
        detail={detail}
        isCreator={detail.created_by === access.userId}
        payment={payment}
        paymentLinkable={hasPermission(access, PERMISSIONS.paymentsView)}
      />
    </div>
  );
}
