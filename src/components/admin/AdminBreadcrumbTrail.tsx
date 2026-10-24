"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect } from "react";

export type AdminCrumb = { label: string; href: string };

export type AdminTrail = { pathname: string; items: AdminCrumb[] };

export const AdminTrailContext = createContext<(trail: AdminTrail | null) => void>(() => {});

/** Thêm các cấp breadcrumb động (vd. tên chương trình / trang con) sau trang con của hub. */
export function AdminBreadcrumbTrail({ items }: { items: AdminCrumb[] }) {
  const setTrail = useContext(AdminTrailContext);
  const pathname = usePathname() || "";
  const key = JSON.stringify(items);

  useEffect(() => {
    setTrail({ pathname, items: JSON.parse(key) as AdminCrumb[] });
    return () => setTrail(null);
  }, [setTrail, pathname, key]);

  return null;
}
