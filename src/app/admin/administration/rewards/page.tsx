import { redirect } from "next/navigation";
import { RewardProgramList } from "@/components/rewards/RewardProgramList";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadPaymentsForRewardPolls } from "@/lib/payments/server";
import { listClosedPolls } from "@/lib/polls/rewards-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{ poll?: string | string[] }>;
};

export default async function RewardProgramsPage({ searchParams }: PageProps) {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/administration/rewards");
  if (!hasPermission(access, PERMISSIONS.rewardsPayout)) redirect("/");

  const requested = (await searchParams).poll;
  const legacyPoll = Array.isArray(requested) ? requested[0] : requested;
  if (legacyPoll) redirect(`/admin/administration/rewards/${encodeURIComponent(legacyPoll)}`);

  const db = createServiceClient();
  const polls = await listClosedPolls(db);
  const payments = await loadPaymentsForRewardPolls(
    db,
    polls.map((p) => p.id),
  );

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-headline-md font-extrabold text-[#173A67]">Thanh toán thưởng</h1>
        <p className="text-sm text-on-surface-variant">
          Các chương trình đã kết thúc. Mỗi chương trình có danh sách nhận thưởng riêng – chọn một chương trình để xem,
          in hoặc xuất Excel.
        </p>
      </div>
      <RewardProgramList
        paymentLinkable={hasPermission(access, PERMISSIONS.paymentsView)}
        programs={polls.map((p) => ({ ...p, payment: payments.get(p.id) ?? null }))}
      />
    </div>
  );
}
