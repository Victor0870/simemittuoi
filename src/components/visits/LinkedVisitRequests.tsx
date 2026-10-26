import Link from "next/link";
import { VisitStatusBadge } from "@/components/visits/VisitStatusBadge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateTimeVi } from "@/lib/data/albums";
import { formatVnd } from "@/lib/visits/registry";
import type { VisitRequestListItem } from "@/lib/visits/server";

type Props = {
  lifeEventId: string;
  items: VisitRequestListItem[];
  canCreate: boolean;
};

/** Phiếu đề nghị thăm hỏi lập từ một tin báo (chỉ hiện với Ban chấp hành). */
export function LinkedVisitRequests({ lifeEventId, items, canCreate }: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title-md font-bold text-[#173A67]">Đề nghị thăm hỏi ({items.length})</h2>
        {canCreate ? (
          <Link
            prefetch={false}
            className="inline-flex items-center gap-1 rounded-xl bg-[#173A67] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#1E4A7D]"
            href={`/admin/administration/visits/new?event=${lifeEventId}`}
          >
            <MaterialIcon className="text-[18px]" name="volunteer_activism" />
            Lập đề nghị thăm hỏi
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Chưa có đề nghị thăm hỏi nào cho tin báo này.</p>
      ) : (
        <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-white">
          {items.map((v) => (
            <li key={v.id}>
              <Link prefetch={false} className="flex flex-wrap items-center gap-2 px-3 py-2 hover:bg-surface-container-low" href={`/admin/administration/visits/${v.id}`}>
                <span className="font-bold text-[#173A67]">{v.code}</span>
                <span className="font-semibold">{formatVnd(v.amount)}</span>
                <VisitStatusBadge status={v.status} />
                <span className="ml-auto text-[11px] text-on-surface-variant">
                  {v.creator_name ? `${v.creator_name} · ` : ""}
                  {formatDateTimeVi(v.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
