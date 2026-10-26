import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminBreadcrumbTrail } from "@/components/admin/AdminBreadcrumbTrail";
import { LifeEventDetailView } from "@/components/life-events/LifeEventDetailView";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { LinkedVisitRequests } from "@/components/visits/LinkedVisitRequests";
import { getCurrentAccess } from "@/lib/auth/guard";
import { canHandleLifeEvents, canViewAllLifeEvents, loadLifeEventDetail } from "@/lib/life-events/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadVisitRequestList, visitAbilities } from "@/lib/visits/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminLifeEventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/admin/administration/life-events/${encodeURIComponent(id)}`);
  if (!canViewAllLifeEvents(access)) redirect("/");

  const db = createServiceClient();
  const detail = await loadLifeEventDetail(db, id);
  if (!detail) notFound();

  const visitCan = visitAbilities(access);
  const visitList = visitCan.view ? await loadVisitRequestList(db, { lifeEventId: detail.id }) : null;

  return (
    <div className="max-w-3xl space-y-4 pb-10">
      <AdminBreadcrumbTrail
        items={[{ label: detail.code, href: `/admin/administration/life-events/${detail.id}` }]}
      />
      <Link
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
        href="/admin/administration/life-events"
      >
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        Hộp tin báo
      </Link>
      <LifeEventDetailView
        canHandle={canHandleLifeEvents(access)}
        detail={detail}
        isOffice
        isOwner={detail.member_id === access.userId}
        userId={access.userId}
      />
      {visitList ? (
        <LinkedVisitRequests
          canCreate={visitCan.create && detail.status !== "withdrawn"}
          items={visitList}
          lifeEventId={detail.id}
        />
      ) : null}
    </div>
  );
}
