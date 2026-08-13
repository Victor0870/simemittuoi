"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { USER_AVATAR_URL } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

type AuthState = {
  loading: boolean;
  isGuest: boolean;
  score: number;
};

export function TopNavAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    isGuest: true,
    score: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setState({ loading: false, isGuest: true, score: 0 });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.approval_status !== "approved") {
        setState({ loading: false, isGuest: true, score: 0 });
        return;
      }

      const { data: rankRow } = await supabase
        .from("leaderboard")
        .select("total_score")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      setState({
        loading: false,
        isGuest: false,
        score: rankRow?.total_score ?? 0,
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return <div className="h-8 w-24 animate-pulse rounded-xl bg-surface-container" />;
  }

  if (state.isGuest) {
    return (
      <Link
        className="rounded-xl bg-tertiary px-4 py-2 text-sm font-bold text-on-tertiary"
        href="/login"
      >
        Đăng nhập
      </Link>
    );
  }

  return (
    <>
      <div className="hidden items-center rounded-full bg-primary-fixed px-3 py-1 font-bold text-on-primary-fixed sm:flex">
        <MaterialIcon className="mr-1 text-sm" name="stars" />
        <span className="text-label-md">
          {state.score.toLocaleString("vi-VN")} Điểm
        </span>
      </div>
      <button
        aria-label="Thông báo"
        className="cursor-pointer rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
        type="button"
      >
        <MaterialIcon name="notifications" />
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
    </>
  );
}
