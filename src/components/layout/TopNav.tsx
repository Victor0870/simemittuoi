import Link from "next/link";
import { TopNavAuth } from "@/components/layout/TopNavAuth";
import { NAV_ITEMS } from "@/lib/constants";

type TopNavProps = {
  activeHref?: string;
};

export function TopNav({ activeHref = "/" }: TopNavProps) {
  return (
    <nav className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-margin-mobile shadow-sm md:px-margin-desktop">
      <Link
        className="shrink-0 text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
        href="/"
      >
        logo
      </Link>

      <div className="hidden items-center gap-4 lg:gap-8 md:flex">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === activeHref;

          return (
            <Link
              key={item.href}
              className={`text-label-md transition-colors ${
                isActive
                  ? "border-b-2 border-primary pb-1 text-primary"
                  : "rounded px-2 py-1 text-on-surface-variant hover:bg-surface-container-high"
              }`}
              href={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <TopNavAuth />
      </div>
    </nav>
  );
}
