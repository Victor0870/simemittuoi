"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/client";
import { CDILV_TABLE } from "@/lib/supabase/tables";

type Props = {
  activeHref?: string;
};

export function AdminNavLinks({ activeHref = "/" }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function checkRole(user: User | null) {
      if (cancelled) return;
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from(CDILV_TABLE.profiles)
        .select("role, approval_status")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      setIsAdmin(profile?.role === "admin" && profile?.approval_status === "approved");
    }

    void supabase.auth.getUser().then(({ data }) => checkRole(data.user));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void checkRole(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!isAdmin) return null;

  const isScoresActive = activeHref.startsWith("/admin/scores");
  const isUsersActive = activeHref.startsWith("/admin/users");

  return (
    <div className="flex items-center gap-2 border-l border-outline-variant/60 pl-3">
      <Link
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-label-md font-bold transition-all ${
          isScoresActive
            ? "bg-amber-500 text-white shadow-xs"
            : "bg-amber-50 text-amber-900 border border-amber-300/80 hover:bg-amber-100"
        }`}
        href="/admin/scores"
        title="Quản trị: Cộng điểm đoàn viên"
      >
        <MaterialIcon className="text-[18px]" name="military_tech" />
        <span>Cộng điểm</span>
      </Link>

      <Link
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-label-md transition-all ${
          isUsersActive
            ? "bg-primary text-white font-bold shadow-xs"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
        href="/admin/users"
        title="Quản trị: Duyệt tài khoản đoàn viên"
      >
        <MaterialIcon className="text-[18px]" name="manage_accounts" />
        <span>Duyệt TV</span>
      </Link>
    </div>
  );
}
