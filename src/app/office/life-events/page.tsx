import { redirect } from "next/navigation";
import { LifeEventInbox } from "@/components/life-events/LifeEventInbox";
import { getCurrentAccess } from "@/lib/auth/guard";
import { canViewAllLifeEvents, loadLifeEventList } from "@/lib/life-events/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function OfficeLifeEventsPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/office/life-events");
  if (!canViewAllLifeEvents(access)) redirect("/");

  const items = await loadLifeEventList(createServiceClient(), null);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Hộp tin báo</h1>
          <p className="text-sm text-on-surface-variant">
            Tin vui, tin ốm, khó khăn đoàn viên gửi lên. Bấm vào từng tin để xem giấy tờ và tiếp nhận.
          </p>
        </div>
      </div>
      <LifeEventInbox items={items} />
    </div>
  );
}
