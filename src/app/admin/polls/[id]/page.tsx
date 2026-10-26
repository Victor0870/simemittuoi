import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminBreadcrumbTrail } from "@/components/admin/AdminBreadcrumbTrail";
import { PollAdminToolbar } from "@/components/polls/PollAdminToolbar";
import { PollPhaseBadge } from "@/components/polls/PollPhaseBadge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { getPollByIdUncached } from "@/lib/data/polls";
import { formatPollTime } from "@/lib/polls/phase";
import { toPublicPollView } from "@/lib/polls/entry-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminPollDetailPage({ params }: Props) {
  const { id } = await params;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/admin/polls/${encodeURIComponent(id)}`);
  if (!hasPermission(access, PERMISSIONS.pollsManage)) redirect("/");

  const fullPoll = await getPollByIdUncached(id);
  if (!fullPoll) notFound();

  // Form sửa tự tải bản đầy đủ khi mở; thanh công cụ chỉ cần dữ liệu rút gọn
  const poll = toPublicPollView(fullPoll);
  const now = Date.now();
  const optionCount = poll.options.length;

  return (
    <div className="space-y-6">
      <AdminBreadcrumbTrail items={[{ label: poll.title, href: `/admin/polls/${poll.id}` }]} />

      <PollAdminToolbar poll={poll} />

      <section className="space-y-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <PollPhaseBadge initialNow={now} poll={poll} />
          {!poll.isActive ? (
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">Tạm ẩn (Inactive)</span>
          ) : null}
          <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
            {poll.voteMode === "points" ? "Vote theo point" : "Bình chọn bài thi"}
          </span>
        </div>
        <h1 className="text-xl font-extrabold text-[#173A67] sm:text-2xl">{poll.title}</h1>
        <dl className="grid gap-2 text-sm text-on-surface-variant sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase">Mở bình chọn</dt>
            <dd className="font-semibold text-on-surface">
              {poll.opensAt ? formatPollTime(poll.opensAt) : new Date(poll.createdAt).toLocaleDateString("vi-VN")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase">Số bài thi</dt>
            <dd className="font-semibold text-on-surface">{optionCount}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary px-3 py-2 text-sm font-bold text-primary transition hover:bg-primary hover:text-white"
            href={`/polls/${poll.id}`}
          >
            <MaterialIcon className="text-[18px]" name="open_in_new" />
            Xem trang bình chọn
          </Link>
          <Link
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
            href="/admin/polls"
          >
            <MaterialIcon className="text-[18px]" name="arrow_back" />
            Tất cả chương trình
          </Link>
        </div>
      </section>
    </div>
  );
}
