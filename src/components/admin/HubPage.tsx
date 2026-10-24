import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export type HubTint = "dusty" | "amber" | "surface";

export type HubKpi = { label: string; value: string | number; icon: string };

export type HubTile = {
  href: string;
  title: string;
  description: string;
  icon: string;
  tint?: HubTint;
  badge?: string | null;
};

const TINT_CLASS: Record<HubTint, string> = {
  dusty: "bg-dusty-light text-primary",
  amber: "bg-amber-light text-amber-700",
  surface: "bg-surface-container text-[#173A67]",
};

export function HubTileGrid({ tiles }: { tiles: HubTile[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <Link
          key={t.href + t.title}
          className="group flex items-start gap-3.5 rounded-2xl border border-border-subtle bg-white p-5 transition hover:border-primary hover:shadow-md"
          href={t.href}
        >
          <div className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl ${TINT_CLASS[t.tint ?? "dusty"]}`}>
            <MaterialIcon className="text-[24px]" name={t.icon} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold text-on-surface transition-colors group-hover:text-primary">{t.title}</p>
              {t.badge ? (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-light px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  {t.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{t.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Trang hub của một nhóm quản trị: tiêu đề, hàng chỉ số (tùy chọn) và lưới ô dẫn tới từng module. */
export function HubPage({
  title,
  subtitle,
  kpis = [],
  tiles,
}: {
  title: string;
  subtitle: string;
  kpis?: HubKpi[];
  tiles: HubTile[];
}) {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-headline-md font-extrabold text-[#173A67]">{title}</h1>
        <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
      </div>

      {kpis.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border-subtle bg-white p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
                <MaterialIcon className="text-[16px] text-primary" name={k.icon} />
                <span>{k.label}</span>
              </div>
              <p className="mt-1.5 text-xl font-extrabold text-[#173A67]">{k.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {tiles.length ? (
        <HubTileGrid tiles={tiles} />
      ) : (
        <div className="rounded-2xl border border-border-subtle bg-white p-6 text-center text-sm text-on-surface-variant">
          Bạn chưa được phân quyền sử dụng chức năng nào trong nhóm này. Vui lòng liên hệ Quản trị viên.
        </div>
      )}
    </div>
  );
}
