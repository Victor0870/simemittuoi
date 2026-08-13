import Image from "next/image";
import Link from "next/link";
import { TopNavAuth } from "@/components/layout/TopNavAuth";
import { LOGO_URL, NAV_ITEMS } from "@/lib/constants";

type TopNavProps = {
  activeHref?: string;
};

export function TopNav({ activeHref = "/" }: TopNavProps) {
  return (
    <nav className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-margin-mobile shadow-sm md:px-margin-desktop">
      <div className="flex items-center gap-3">
        <Image
          alt="Logo Si Mê Mít Tươi"
          className="rounded-lg"
          height={40}
          src={LOGO_URL}
          width={40}
        />
        <span className="text-headline-md font-extrabold text-primary">
          Si Mê Mít Tươi
        </span>
      </div>

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
