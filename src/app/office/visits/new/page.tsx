import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitRequestForm } from "@/components/visits/VisitRequestForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { describeSubject, TYPE_BY_CODE } from "@/lib/life-events/registry";
import { loadLifeEventRow } from "@/lib/life-events/server";
import { formatDateVi } from "@/lib/members/profile-shared";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { defaultVisitReason } from "@/lib/visits/registry";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ event?: string }> };

export default async function NewVisitRequestPage({ searchParams }: PageProps) {
  const { event: eventId } = await searchParams;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/office/visits/new${eventId ? `?event=${eventId}` : ""}`);
  if (!hasPermission(access, PERMISSIONS.visitsCreate)) redirect("/office/visits");

  const db = createServiceClient();
  const [settings, event, { data: me }] = await Promise.all([
    loadFormSettings(db),
    eventId ? loadLifeEventRow(db, eventId) : Promise.resolve(null),
    db.from(CDILV_TABLE.profiles).select("full_name").eq("id", access.userId).maybeSingle(),
  ]);

  type MemberRef = { employee_code: string; full_name: string; department: string | null };
  let member: MemberRef | null = null;
  if (event) {
    const { data } = await db
      .from(CDILV_TABLE.profiles)
      .select("employee_code, full_name, department")
      .eq("id", event.member_id)
      .maybeSingle();
    if (data?.employee_code) member = data as MemberRef;
  }

  const eventType = event?.event_type ?? "";
  const preset = eventType ? settings.visitAmounts[eventType] : undefined;

  return (
    <div className="max-w-3xl space-y-4 pb-10">
      <Link
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
        href={event ? `/life-events/${event.id}` : "/office/visits"}
      >
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        {event ? `Tin báo ${event.code}` : "Đề nghị thăm hỏi"}
      </Link>
      <div>
        <h1 className="text-headline-md font-extrabold text-[#173A67]">Lập đề nghị thăm hỏi</h1>
        <p className="text-sm text-on-surface-variant">
          Sau khi lập, người có quyền duyệt nhận thông báo. Phiếu thăm hỏi tải được ngay để trình ký.
        </p>
      </div>

      {event ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <p className="font-bold">
            Từ tin báo {event.code}: {TYPE_BY_CODE[event.event_type]?.label ?? event.event_type}
          </p>
          <p>
            {describeSubject(event.subject_relation, event.subject_name)} · {formatDateVi(event.event_date)}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
      ) : null}

      <VisitRequestForm
        defaultAmounts={settings.visitAmounts}
        initial={{
          employeeCode: member?.employee_code ?? "",
          memberName: member?.full_name ?? "",
          memberDepartment: member?.department ?? "",
          eventType,
          reason: event ? defaultVisitReason(event) : "",
          amount: preset ? String(preset) : "",
          visitorName: settings.preparerName || (me?.full_name as string | undefined) || "",
          note: "",
        }}
        lifeEventId={event?.id ?? null}
        mode="create"
      />
    </div>
  );
}
