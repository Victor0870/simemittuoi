import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminShortcutLink } from "@/components/admin/AdminShortcutLink";
import { LifeEventDetailView } from "@/components/life-events/LifeEventDetailView";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { canViewAllLifeEvents, canViewLifeEvent, loadLifeEventDetail } from "@/lib/life-events/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; uploadFailed?: string }>;
};

export default async function LifeEventDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { sent, uploadFailed } = await searchParams;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/life-events/${id}`);

  const detail = await loadLifeEventDetail(createServiceClient(), id);
  if (!detail || !canViewLifeEvent(access, detail)) notFound();

  const isOffice = canViewAllLifeEvents(access);
  const isOwner = detail.member_id === access.userId;
  const adminHref = `/admin/administration/life-events/${detail.id}`;
  // Tiếp nhận / xử lý tin báo chỉ ở trang quản trị; trang này là góc nhìn của người báo tin
  if (isOffice && !isOwner) redirect(adminHref);
  const visible = { ...detail, logs: detail.logs.filter((l) => l.action !== "note") };

  return (
    <div className="max-w-3xl space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
          href="/life-events"
        >
          <MaterialIcon className="text-[18px]" name="arrow_back" />
          Tin bạn đã báo
        </Link>
        <AdminShortcutLink href={adminHref} icon="inbox" label="Xử lý trong Hộp tin báo" />
      </div>
      {sent ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <MaterialIcon className="text-[20px]" name="check_circle" />
          Đã gửi tin báo {detail.code}. Ban chấp hành sẽ tiếp nhận và báo lại cho bạn.
        </div>
      ) : null}
      {uploadFailed ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <MaterialIcon className="text-[20px]" name="warning" />
          Tin báo đã gửi nhưng {uploadFailed} tệp chưa tải lên được. Bạn có thể bổ sung lại ở mục Giấy tờ bên dưới.
        </div>
      ) : null}
      <LifeEventDetailView
        canHandle={false}
        detail={visible}
        isOffice={false}
        isOwner={isOwner}
        userId={access.userId}
      />
    </div>
  );
}
