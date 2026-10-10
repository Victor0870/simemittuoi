"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/client";
import { CDILV_TABLE } from "@/lib/supabase/tables";

type AuthState = {
  loading: boolean;
  isGuest: boolean;
  isAdmin: boolean;
  avatarUrl: string | null;
  initial: string;
};

export function TopNavAuth() {
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({
    loading: true,
    isGuest: true,
    isAdmin: false,
    avatarUrl: null,
    initial: "?",
  });

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function applyUser(user: User | null) {
      if (cancelled) return;

      if (!user) {
        setState({
          loading: false,
          isGuest: true,
          isAdmin: false,
          avatarUrl: null,
          initial: "?",
        });
        return;
      }

      const { data: profile } = await supabase
        .from(CDILV_TABLE.profiles)
        .select("approval_status, full_name, avatar_url, role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.approval_status !== "approved") {
        setState({
          loading: false,
          isGuest: true,
          isAdmin: false,
          avatarUrl: null,
          initial: "?",
        });
        return;
      }

      setState({
        loading: false,
        isGuest: false,
        isAdmin: profile?.role === "admin",
        avatarUrl: profile.avatar_url ?? null,
        initial: (profile.full_name || user.email || "?").slice(0, 1).toUpperCase(),
      });
    }

    void supabase.auth.getUser().then(({ data }) => applyUser(data.user));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applyUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname]);

  if (state.loading) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-surface-container" />
    );
  }

  if (state.isGuest) {
    return (
      <div className="flex items-center gap-2">
        <Link
          className="rounded-xl border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
          href="/login"
        >
          Đăng nhập
        </Link>
        <Link
          className="hidden rounded-xl bg-primary px-3 py-1.5 text-sm font-bold text-white hover:bg-dusty-dark sm:inline-flex"
          href="/register"
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  return (
    <>
      {state.isAdmin ? (
        <Link
          className="hidden items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 transition hover:bg-amber-100 sm:inline-flex"
          href="/admin/scores"
          title="Trang quản trị điểm thi đua"
        >
          <MaterialIcon className="text-[15px] text-amber-600" name="military_tech" />
          <span>Admin</span>
        </Link>
      ) : null}
      <button
        aria-label="Thông báo"
        className="cursor-pointer rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
        type="button"
      >
        <MaterialIcon name="notifications" />
      </button>
      <Link
        aria-label="Cài đặt hồ sơ"
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-dusty-light font-bold text-primary"
        href="/settings"
        title="Cài đặt / Avatar"
      >
        {state.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="Ảnh đại diện"
            className="h-full w-full object-cover"
            src={state.avatarUrl}
          />
        ) : (
          state.initial
        )}
      </Link>
    </>
  );
}
