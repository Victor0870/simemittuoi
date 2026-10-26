import Link from "next/link";
import { HubTileGrid, type HubTile } from "@/components/admin/HubPage";
import { OverviewGreeting } from "@/components/admin/OverviewGreeting";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export type OverviewKpi = {
  label: string;
  value: string | number;
  icon: string;
  sub?: string;
  /** Tô màu hổ phách cho dòng phụ (cần xử lý). */
  subAlert?: boolean;
};

export type OverviewTask = {
  href: string;
  /** Số việc đang chờ; 0 → dòng xám với emptyText. */
  count: number;
  text: string;
  emptyText: string;
  tone?: "alert" | "info";
};

export type OverviewAction = { href: string; label: string; icon: string };

const DOT_CLASS = { alert: "bg-amber-500", info: "bg-primary", empty: "bg-outline-variant" } as const;

/** Trang tổng quan một màn hình: lời chào, chỉ số, việc cần xử lý, thao tác nhanh và (tùy chọn) lưới công cụ. */
export function AdminOverview({
  name,
  kpis,
  tasks,
  actions,
  tiles,
}: {
  name?: string | null;
  kpis: OverviewKpi[];
  tasks: OverviewTask[];
  actions: OverviewAction[];
  tiles?: HubTile[];
}) {
  return (
    <div className="space-y-6 pb-10">
      <OverviewGreeting name={name} />

      {kpis.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border-subtle bg-white p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
                <MaterialIcon className="text-[16px] text-primary" name={k.icon} />
                <span>{k.label}</span>
              </div>
              <p className="mt-1.5 text-xl font-extrabold text-[#173A67]">{k.value}</p>
              {k.sub ? (
                <p className={`mt-0.5 text-xs ${k.subAlert ? "font-semibold text-amber-700" : "text-on-surface-variant"}`}>{k.sub}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {tasks.length || actions.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tasks.length ? (
            <section className="rounded-2xl border border-border-subtle bg-white p-5">
              <h2 className="mb-3 font-bold text-[#173A67]">Việc cần xử lý</h2>
              <ul className="divide-y divide-border-subtle">
                {tasks.map((t) => {
                  const empty = t.count <= 0;
                  return (
                    <li key={t.href + t.emptyText} className="flex items-center gap-3 py-2.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[empty ? "empty" : (t.tone ?? "alert")]}`} />
                      <span className={`min-w-0 flex-1 text-sm ${empty ? "text-on-surface-variant" : "font-semibold text-on-surface"}`}>
                        {empty ? t.emptyText : t.text}
                      </span>
                      <Link prefetch={false} className="shrink-0 whitespace-nowrap text-sm font-bold text-primary hover:underline" href={t.href}>
                        Mở →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {actions.length ? (
            <section className="rounded-2xl border border-border-subtle bg-white p-5">
              <h2 className="mb-3 font-bold text-[#173A67]">Thao tác nhanh</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {actions.map((a) => (
                  <Link
                    prefetch={false}
                    key={a.href + a.label}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-container-low px-2 py-4 text-center text-sm font-semibold text-[#173A67] transition hover:border-primary hover:bg-surface-container-high"
                    href={a.href}
                  >
                    <MaterialIcon className="text-[24px] text-primary" name={a.icon} />
                    <span>{a.label}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tiles?.length ? (
        <section className="space-y-3">
          <h2 className="font-bold text-[#173A67]">Công cụ được phân quyền</h2>
          <HubTileGrid tiles={tiles} />
        </section>
      ) : null}
    </div>
  );
}
