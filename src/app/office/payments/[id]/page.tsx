import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PaymentRequestDetailView } from "@/components/payments/PaymentRequestDetailView";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { loadPaymentRequestDetail, paymentAbilities } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function PaymentRequestPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { created } = await searchParams;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/office/payments/${id}`);
  const can = paymentAbilities(access);
  if (!can.view) notFound();

  const db = createServiceClient();
  const [detail, settings] = await Promise.all([loadPaymentRequestDetail(db, id), loadFormSettings(db)]);
  if (!detail) notFound();

  const missingSigners = [
    !settings.accountantName ? "Kế toán Công đoàn" : null,
    !settings.chairmanName ? "Chủ tịch Công đoàn" : null,
  ].filter(Boolean);

  return (
    <div className="max-w-3xl space-y-4 pb-10">
      <Link
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
        href="/office/payments"
      >
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        Đề nghị thanh toán
      </Link>
      {created ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <MaterialIcon className="text-[20px]" name="check_circle" />
          Đã lập đề nghị {detail.code}. Người có quyền duyệt đã nhận được thông báo.
        </div>
      ) : null}
      {missingSigners.length ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <MaterialIcon className="text-[20px]" name="warning" />
          Chưa cài họ tên {missingSigners.join(", ")} nên ô chữ ký trên giấy sẽ để trống. Vào Cài đặt biểu mẫu in để nhập.
        </div>
      ) : null}
      <PaymentRequestDetailView
        can={can}
        canViewVisits={hasPermission(access, PERMISSIONS.visitsView)}
        detail={detail}
        isCreator={detail.created_by === access.userId}
      />
    </div>
  );
}
