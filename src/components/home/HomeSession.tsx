"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ActivitiesSection } from "@/components/home/ActivitiesSection";
import { HeroWelcome } from "@/components/home/HeroWelcome";
import { HomeLeaderboardSection } from "@/components/home/HomeLeaderboardSection";
import type { HomeSessionInfo } from "@/lib/data/home";
import type { Activity, LeaderboardEntry } from "@/lib/mock-data";

type HomeSessionState = {
  loading: boolean;
  info: HomeSessionInfo | null;
};

const GUEST_INFO: HomeSessionInfo = {
  isGuest: true,
  user: { name: "Khách", score: 0, rank: 0, newActivitiesCount: 0 },
  registeredActivityIds: [],
};

const HomeSessionContext = createContext<HomeSessionState>({ loading: true, info: null });

/**
 * Trang chủ được cache chung (ISR); phần riêng của người xem (tên, điểm, hạng,
 * hoạt động đã đăng ký) tải riêng qua /api/home/session sau khi trang hiện ra.
 */
export function HomeSessionProvider({
  activityIds,
  children,
}: {
  activityIds: string[];
  children: ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const idsKey = activityIds.join(",");
  const [state, setState] = useState<HomeSessionState>({ loading: true, info: null });

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setState({ loading: false, info: GUEST_INFO });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ loading: true, info: prev.info }));
    fetch(`/api/home/session?activityIds=${encodeURIComponent(idsKey)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? (res.json() as Promise<HomeSessionInfo>) : GUEST_INFO))
      .catch(() => GUEST_INFO)
      .then((info) => {
        if (!cancelled) setState({ loading: false, info });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, idsKey]);

  return <HomeSessionContext.Provider value={state}>{children}</HomeSessionContext.Provider>;
}

function useHomeSession() {
  return useContext(HomeSessionContext);
}

export function HomeHero() {
  const { loading, info } = useHomeSession();
  const current = info ?? GUEST_INFO;
  return <HeroWelcome isGuest={current.isGuest} loading={loading} user={current.user} />;
}

export function HomeLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const { loading, info } = useHomeSession();
  return (
    <HomeLeaderboardSection
      entries={entries}
      maskIdentity={loading || (info?.isGuest ?? true)}
    />
  );
}

export function HomeActivities({ activities }: { activities: Activity[] }) {
  const { info } = useHomeSession();
  const items = useMemo(() => {
    const registered = new Set(info?.registeredActivityIds ?? []);
    return activities.map((activity) => ({
      ...activity,
      isRegistered: registered.has(activity.id),
    }));
  }, [activities, info]);
  return <ActivitiesSection activities={items} />;
}
