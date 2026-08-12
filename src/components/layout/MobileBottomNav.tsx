import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { MOBILE_NAV_ITEMS } from "@/lib/constants";

type MobileBottomNavProps = {
  activeHref?: string;
};

export function MobileBottomNav({ activeHref = "/" }: MobileBottomNavProps) {
  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 flex h-16 items-center justify-around border-t border-outline-variant bg-surface-container-lowest shadow-lg md:hidden">
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive = item.href === activeHref;

        return (
          <Link
            key={item.href}
            className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1 ${
              isActive
                ? "bg-tertiary-container text-on-tertiary-container"
                : "text-on-surface-variant"
            }`}
            href={item.href}
          >
            <MaterialIcon filled={isActive} name={item.icon} />
            <span className={`text-[10px] ${isActive ? "font-bold" : ""}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
