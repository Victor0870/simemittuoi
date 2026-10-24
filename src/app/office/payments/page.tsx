import Link from "next/link";
import { redirect } from "next/navigation";
import { PaymentRequestList } from "@/components/payments/PaymentRequestList";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadPaymentRequestList, paymentAbilities } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function OfficePaymentsPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/office/payments");
  const can = paymentAbilities(access);
  if (!can.view) redirect("/");

  const items = await loadPaymentRequestList(createServiceClient());

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Đề nghị thanh toán</h1>
          <p className="text-sm text-on-surface-variant">
            Lập giấy đề nghị (nhập từng khoản hoặc gom phiếu thăm hỏi đã duyệt), Chủ tịch duyệt, kế toán xác nhận đã chi. Tải
            giấy đề nghị theo mẫu công ty.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission(access, PERMISSIONS.formsSettings) ? (
            <Link
              className="flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
              href="/office/print-settings"
            >
              <MaterialIcon className="text-[18px]" name="settings" />
              Người ký
            </Link>
          ) : null}
          {can.create ? (
            <Link
              className="flex items-center gap-1 rounded-xl bg-[#173A67] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#1E4A7D]"
              href="/office/payments/new"
            >
              <MaterialIcon className="text-[18px]" name="add" />
              Lập đề nghị
            </Link>
          ) : null}
        </div>
      </div>
      <PaymentRequestList items={items} />
    </div>
  );
}
