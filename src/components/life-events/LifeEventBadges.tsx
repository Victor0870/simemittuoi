import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  CATEGORY_BY_KEY,
  STATUS_LABEL,
  STATUS_TONE,
  type LifeEventCategory,
  type LifeEventStatus,
} from "@/lib/life-events/registry";

export function CategoryBadge({ category }: { category: LifeEventCategory }) {
  const def = CATEGORY_BY_KEY[category];
  if (!def) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${def.tone}`}>
      <MaterialIcon className="text-[14px]" name={def.icon} />
      {def.short}
    </span>
  );
}

export function StatusBadge({ status }: { status: LifeEventStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
