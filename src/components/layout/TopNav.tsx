import Image from "next/image";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { LOGO_URL, NAV_ITEMS, USER_AVATAR_URL } from "@/lib/constants";
import { MOCK_USER } from "@/lib/mock-data";

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

      <div className="hidden items-center gap-8 md:flex">
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
        <div className="hidden items-center rounded-full bg-primary-fixed px-3 py-1 font-bold text-on-primary-fixed sm:flex">
          <MaterialIcon className="mr-1 text-sm" name="stars" />
          <span className="text-label-md">
            {MOCK_USER.score.toLocaleString("vi-VN")} Điểm
          </span>
        </div>
        <button
          aria-label="Thông báo"
          className="cursor-pointer rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
          type="button"
        >
          <MaterialIcon name="notifications" />
        </button>
        <button
          aria-label="Trợ giúp"
          className="cursor-pointer rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
          type="button"
        >
          <MaterialIcon name="help" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-fixed font-bold text-primary">
          <Image
            alt="Ảnh đại diện đoàn viên"
            className="h-full w-full object-cover"
            height={32}
            src={USER_AVATAR_URL}
            width={32}
          />
        </div>
      </div>
    </nav>
  );
}
