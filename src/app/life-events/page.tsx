import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShortcutLink } from "@/components/admin/AdminShortcutLink";
import { CategoryBadge, StatusBadge } from "@/components/life-events/LifeEventBadges";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { formatDateTimeVi } from "@/lib/data/albums";
import { MEMBER_LIFE_EVENT_CATEGORIES, TYPE_BY_CODE, describeSubject } from "@/lib/life-events/registry";
import { loadLifeEventList } from "@/lib/life-events/server";
import { formatDateVi } from "@/lib/members/profile-shared";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function LifeEventsPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/life-events");
  if (!access.isApproved) redirect("/pending");

  const items = await loadLifeEventList(createServiceClient(), access.userId, 100);

  return (
    <div className="max-w-4xl space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Báo tin</h1>
          <p className="text-sm text-on-surface-variant">
            Gia đình có tin vui, ốm đau hay khó khăn — bấm một nút để báo, kèm ảnh giấy tờ. Ban chấp hành sẽ tiếp nhận
            và báo lại cho bạn.
          </p>
        </div>
        <AdminShortcutLink href="/admin/administration/life-events" icon="inbox" label="Hộp tin báo" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MEMBER_LIFE_EVENT_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            className={`group flex items-center gap-4 rounded-2xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${c.tone}`}
            href={`/life-events/new/${c.key}`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80">
              <MaterialIcon className="text-[28px]" name={c.icon} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold">{c.label}</p>
              <p className="text-xs opacity-80">{c.hint}</p>
            </div>
            <MaterialIcon className="text-[22px] opacity-60 transition group-hover:translate-x-0.5" name="chevron_right" />
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-title-md font-bold text-[#173A67]">Tin bạn đã báo</h2>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">
            Bạn chưa báo tin nào.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((e) => (
              <li key={e.id}>
                <Link
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 transition hover:border-[#173A67]"
                  href={`/life-events/${e.id}`}
                >
                  <CategoryBadge category={e.category} />
                  <span className="font-bold text-[#173A67]">{TYPE_BY_CODE[e.event_type]?.label ?? e.event_type}</span>
                  <span className="text-sm text-on-surface-variant">
                    {describeSubject(e.subject_relation, e.subject_name)} · {formatDateVi(e.event_date)}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {e.attachment_count ? (
                      <span className="flex items-center gap-0.5 text-xs text-on-surface-variant">
                        <MaterialIcon className="text-[14px]" name="attach_file" />
                        {e.attachment_count}
                      </span>
                    ) : null}
                    <StatusBadge status={e.status} />
                  </span>
                  <span className="w-full text-[11px] text-on-surface-variant">
                    {e.code} · gửi lúc {formatDateTimeVi(e.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
