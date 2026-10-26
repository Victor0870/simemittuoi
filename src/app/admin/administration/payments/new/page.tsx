import Link from "next/link";
import { redirect } from "next/navigation";
import { PaymentRequestForm } from "@/components/payments/PaymentRequestForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadCounterparties } from "@/lib/catalogs/server";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { newPaymentItem } from "@/lib/payments/form-items";
import { loadLastReceiver, loadPaymentMembers } from "@/lib/payments/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";

export default async function NewPaymentRequestPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/administration/payments/new");
  if (!hasPermission(access, PERMISSIONS.paymentsCreate)) redirect("/admin/administration/payments");

  const db = createServiceClient();
  const [settings, last, { data: me }, counterparties, members] = await Promise.all([
    loadFormSettings(db),
    loadLastReceiver(db, access.userId),
    db.from(CDILV_TABLE.profiles).select("full_name").eq("id", access.userId).maybeSingle(),
    loadCounterparties(db, { activeOnly: true }),
    loadPaymentMembers(db),
  ]);
  const lastPartyRow = counterparties.find((c) => c.id === last?.counterparty_id) ?? null;
  const lastMember = last?.receiver_kind === "member" && members.some((m) => m.id === last.receiver_member_id);
  const receiverKind = lastMember ? "member" : (lastPartyRow?.kind ?? last?.receiver_kind ?? "organization");
  const keepLast = receiverKind !== "member" || lastMember;

  return (
    <div className="max-w-3xl space-y-4 pb-10">
      <Link
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
        href="/admin/administration/payments"
      >
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        Đề nghị thanh toán
      </Link>
      <div>
        <h1 className="text-headline-md font-extrabold text-[#173A67]">Lập giấy đề nghị thanh toán</h1>
        <p className="text-sm text-on-surface-variant">
          Sau khi lập, người có quyền duyệt nhận thông báo. Khi xác nhận đã chi, các phiếu thăm hỏi gom trong đề nghị tự chuyển
          sang “Đã chi”.
        </p>
      </div>

      <PaymentRequestForm
        canGatherVisits={hasPermission(access, PERMISSIONS.visitsView)}
        initial={{
          requestDate: todayInVietnam(),
          title: "",
          requesterName: settings.preparerName || (me?.full_name as string | undefined) || "",
          requesterDepartment: last?.requester_department ?? settings.preparerDepartment,
          paymentMethod: "transfer",
          receiverKind,
          receiverMemberId: lastMember ? (last?.receiver_member_id ?? "") : "",
          receiverName: keepLast ? (last?.receiver_name ?? "") : "",
          receiverAccount: keepLast ? (last?.receiver_account ?? "") : "",
          receiverBank: keepLast ? (last?.receiver_bank ?? "") : "",
          counterpartyId: lastPartyRow?.id ?? "",
          note: "",
          items: [newPaymentItem()],
        }}
        counterparties={counterparties}
        members={members}
        mode="create"
      />
    </div>
  );
}
