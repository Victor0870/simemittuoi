import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { NAV_ITEMS } from "@/lib/constants";

type SidebarProps = {
  activeHref?: string;
};

export function Sidebar({ activeHref = "/" }: SidebarProps) {
  return (
    <aside className="fixed top-16 left-0 hidden h-[calc(100vh-64px)] w-64 flex-col gap-2 border-r border-outline-variant bg-surface-container-low p-base md:flex">
      <div className="mb-4 px-4 py-6">
        <h2 className="text-headline-md font-extrabold text-primary">
          Activity Hub
        </h2>
        <p className="text-label-sm text-on-surface-variant">Hỗ trợ Đoàn viên</p>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === activeHref;

          return (
            <Link
              key={item.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                isActive
                  ? "bg-primary-container font-bold text-on-primary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
              href={item.href}
            >
              <MaterialIcon name={item.icon} />
              <span className="text-label-md">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        className="mx-2 mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary transition-all hover:shadow-lg active:scale-95"
        type="button"
      >
        <MaterialIcon name="campaign" />
        Tham gia Chiến dịch
      </button>

      <div className="mt-auto border-t border-outline-variant pt-4 pb-2">
        <Link
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-container-high"
          href="/settings"
        >
          <MaterialIcon name="settings" />
          <span className="text-label-md">Cài đặt</span>
        </Link>
        <Link
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-container-high"
          href="/support"
        >
          <MaterialIcon name="contact_support" />
          <span className="text-label-md">Hỗ trợ</span>
        </Link>
      </div>
    </aside>
  );
}
