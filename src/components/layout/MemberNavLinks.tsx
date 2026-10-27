"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { MEMBER_NAV_ITEMS } from "@/lib/constants";

type Props = {
  activeHref?: string;
};

export function MemberNavLinks({ activeHref = "/" }: Props) {
  const { isApproved } = useAuth();

  if (!isApproved) return null;

  return (
    <>
      {MEMBER_NAV_ITEMS.map((item) => {
        const isActive = activeHref === item.href || activeHref.startsWith(`${item.href}/`);

        return (
          <Link prefetch={false}
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
    </>
  );
}
