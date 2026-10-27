import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RewardPayoutList } from "@/components/rewards/RewardPayoutList";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadPaymentForRewardPoll } from "@/lib/payments/server";
import { loadPollRewardList } from "@/lib/polls/rewards-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ pollId: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RewardPayoutPage({ params }: PageProps) {
  const { pollId } = await params;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/admin/administration/rewards/${encodeURIComponent(pollId)}`);
  if (!hasPermission(access, PERMISSIONS.rewardsPayout)) redirect("/");
  if (!UUID_RE.test(pollId)) notFound();

  const db = createServiceClient();
  const [list, payment] = await Promise.all([
    loadPollRewardList(db, pollId, access.userId),
    loadPaymentForRewardPoll(db, pollId),
  ]);
  if (!list) notFound();

  return (
    <div className="space-y-5 pb-10 print:space-y-0 print:pb-0">
      <div className="space-y-2 print:hidden">
        <Link
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
          href="/admin/administration/rewards"
        >
          <MaterialIcon className="text-[18px]" name="arrow_back" />
          Danh sách chương trình
        </Link>
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">{list.pollTitle}</h1>
          <p className="text-sm text-on-surface-variant">
            Danh sách nhận thưởng
            {list.closedAt
              ? ` – kết thúc ${new Date(list.closedAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
              : ""}
            . Số tiền lấy
            theo &ldquo;Tiền thưởng&rdquo; cài trong Cài đặt cuộc thi; ai chưa khai số tài khoản thì để trống.
          </p>
        </div>
      </div>
      <RewardPayoutList
        list={list}
        payment={payment ? { id: payment.id, code: payment.code } : null}
        paymentLinkable={hasPermission(access, PERMISSIONS.paymentsView)}
      />
    </div>
  );
}
