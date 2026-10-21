import Link from "next/link";
import { redirect } from "next/navigation";
import { RewardPayoutList } from "@/components/rewards/RewardPayoutList";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { listClosedPolls, loadPollRewardList } from "@/lib/polls/rewards-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{ poll?: string | string[] }>;
};

export default async function RewardPayoutPage({ searchParams }: PageProps) {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/office/rewards");
  if (!hasPermission(access, PERMISSIONS.rewardsPayout)) redirect("/");

  const db = createServiceClient();
  const polls = await listClosedPolls(db);
  const requested = (await searchParams).poll;
  const pollId = (Array.isArray(requested) ? requested[0] : requested) || polls[0]?.id || null;
  const list = pollId && polls.some((p) => p.id === pollId) ? await loadPollRewardList(db, pollId, access.userId) : null;

  return (
    <div className="space-y-5 pb-10 print:space-y-0 print:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Thanh toán thưởng</h1>
          <p className="text-sm text-on-surface-variant">
            Danh sách nhận thưởng của chương trình bình chọn đã kết thúc. Số tiền lấy theo &ldquo;Tiền thưởng&rdquo; cài
            trong Cài đặt cuộc thi; ai chưa khai số tài khoản thì để trống.
          </p>
        </div>
        <Link
          className="flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
          href={access.isAdmin ? "/admin" : "/office"}
        >
          <MaterialIcon className="text-[18px]" name="arrow_back" />
          {access.isAdmin ? "Trang Admin" : "Khu vực quản lý"}
        </Link>
      </div>
      <RewardPayoutList list={list} polls={polls} />
    </div>
  );
}
