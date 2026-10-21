import { VISIT_STATUS_LABEL, VISIT_STATUS_TONE, type VisitStatus } from "@/lib/visits/registry";

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${VISIT_STATUS_TONE[status]}`}>
      {VISIT_STATUS_LABEL[status]}
    </span>
  );
}
