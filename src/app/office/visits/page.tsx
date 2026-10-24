import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitRequestList } from "@/components/visits/VisitRequestList";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { loadVisitRequestList, visitAbilities } from "@/lib/visits/server";

export const dynamic = "force-dynamic";

export default async function OfficeVisitsPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/office/visits");
  const can = visitAbilities(access);
  if (!can.view) redirect("/");

  const items = await loadVisitRequestList(createServiceClient());

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Đề nghị thăm hỏi</h1>
          <p className="text-sm text-on-surface-variant">
            Lập đề nghị từ tin báo hoặc trực tiếp, Chủ tịch duyệt, kế toán xác nhận đã chi. Tải phiếu thăm hỏi theo mẫu C11-TLĐ.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission(access, PERMISSIONS.formsSettings) ? (
            <Link
              className="flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
              href="/office/print-settings"
            >
              <MaterialIcon className="text-[18px]" name="settings" />
              Mức chi & người ký
            </Link>
          ) : null}
          {hasPermission(access, PERMISSIONS.paymentsView) ? (
            <Link
              className="flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
              href="/office/payments"
            >
              <MaterialIcon className="text-[18px]" name="request_quote" />
              Đề nghị thanh toán
            </Link>
          ) : null}
          {can.create ? (
            <Link
              className="flex items-center gap-1 rounded-xl bg-[#173A67] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#1E4A7D]"
              href="/office/visits/new"
            >
              <MaterialIcon className="text-[18px]" name="add" />
              Lập đề nghị
            </Link>
          ) : null}
        </div>
      </div>
      <VisitRequestList items={items} />
    </div>
  );
}
