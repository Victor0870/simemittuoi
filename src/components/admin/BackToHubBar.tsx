"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ADMIN_NAV_GROUPS } from "@/components/admin/AdminSidebar";
import { isHubKey } from "@/components/admin/hub-keys";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

function BackToHubBarInner() {
  const from = useSearchParams().get("from");
  if (!isHubKey(from)) return null;
  const href = `/admin/${from}`;
  const group = ADMIN_NAV_GROUPS.find((g) => g.href === href);
  if (!group) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2 text-sm print:hidden">
      <Link prefetch={false} className="flex min-w-0 items-center gap-1.5 font-semibold text-primary hover:text-[#173A67]" href={href}>
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        <span className="truncate">Quay lại {group.label}</span>
      </Link>
      <Link prefetch={false} className="shrink-0 text-on-surface-variant hover:text-[#173A67]" href="/admin">
        Quản trị
      </Link>
    </div>
  );
}

/** Thanh "Quay lại <hub>" cho trang ngoài khung quản trị khi mở từ ô hub (?from=<hub>); không có tham số thì không hiện gì. */
export function BackToHubBar() {
  return (
    <Suspense fallback={null}>
      <BackToHubBarInner />
    </Suspense>
  );
}
