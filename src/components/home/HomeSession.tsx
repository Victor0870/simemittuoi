"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useAuth, type UserProfile } from "@/components/auth/AuthProvider";
import {
  useViewerFetch,
  type ViewerSessionState,
} from "@/components/auth/useViewerSession";
import { ActivitiesSection } from "@/components/home/ActivitiesSection";
import { HeroWelcome } from "@/components/home/HeroWelcome";
import { HomeLeaderboardSection } from "@/components/home/HomeLeaderboardSection";
import type { DashboardUser, HomeSessionInfo } from "@/lib/data/home";
import type { Activity, LeaderboardEntry } from "@/lib/mock-data";

type HomeSessionState = {
  session: ViewerSessionState;
  loading: boolean;
  info: HomeSessionInfo | null;
  activityCount: number;
};

const GUEST_USER: DashboardUser = { name: "Khách", score: 0, rank: 0, newActivitiesCount: 0 };

const HomeSessionContext = createContext<HomeSessionState>({
  session: "unknown",
  loading: true,
  info: null,
  activityCount: 0,
});

function isGuestInfo(info: HomeSessionInfo) {
  return info.isGuest;
}

/**
 * Cùng quy tắc với getHomeSessionInfo: hồ sơ đã có hạng hoặc điểm khác 0 thì dùng luôn;
 * ngược lại (cần tra bảng xếp hạng) phải đợi /api/home/session.
 */
function userFromProfile(profile: UserProfile | null, activityCount: number): DashboardUser | null {
  if (!profile) return null;
  const score = profile.total_score ?? 0;
  const rank = profile.rank ? Number(profile.rank) : 0;
  if (!rank && score === 0) return null;
  return {
    name: profile.full_name ?? "Đoàn viên",
    score,
    rank,
    newActivitiesCount: activityCount,
  };
}

/**
 * Trang chủ được cache chung (ISR); phần riêng của người xem (tên, điểm, hạng,
 * hoạt động đã đăng ký) tải riêng qua /api/home/session ngay khi trang chạy.
 * Khi chưa biết đã đăng nhập hay chưa: hiện khung chờ, không hiện giao diện khách.
 */
export function HomeSessionProvider({
  activityIds,
  children,
}: {
  activityIds: string[];
  children: ReactNode;
}) {
  const url = `/api/home/session?activityIds=${encodeURIComponent(activityIds.join(","))}`;
  const { session, loading, data } = useViewerFetch<HomeSessionInfo>(url, isGuestInfo);
  const value = useMemo<HomeSessionState>(
    () => ({ session, loading, info: data, activityCount: activityIds.length }),
    [session, loading, data, activityIds.length],
  );

  return <HomeSessionContext.Provider value={value}>{children}</HomeSessionContext.Provider>;
}

function useHomeSession() {
  return useContext(HomeSessionContext);
}

export function HomeHero() {
  const { session, loading, info, activityCount } = useHomeSession();
  const { profile } = useAuth();

  if (session === "guest") {
    return <HeroWelcome isGuest user={GUEST_USER} />;
  }
  if (session === "unknown") {
    return <HeroWelcome loading user={GUEST_USER} />;
  }

  const fromApi = info && !info.isGuest ? info.user : null;
  const user = fromApi ?? userFromProfile(profile, activityCount);
  if (!user) {
    if (loading) return <HeroWelcome loading user={GUEST_USER} />;
    return (
      <HeroWelcome
        user={{
          name: profile?.full_name ?? "Đoàn viên",
          score: 0,
          rank: 0,
          newActivitiesCount: activityCount,
        }}
      />
    );
  }
  return <HeroWelcome user={user} />;
}

export function HomeLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const { session } = useHomeSession();
  return (
    <HomeLeaderboardSection
      entries={entries}
      identityPending={session === "unknown"}
      maskIdentity={session !== "member"}
    />
  );
}

export function HomeActivities({ activities }: { activities: Activity[] }) {
  const { session, info } = useHomeSession();
  const items = useMemo(() => {
    const registered = new Set(
      session === "member" && info && !info.isGuest ? info.registeredActivityIds : [],
    );
    return activities.map((activity) => ({
      ...activity,
      isRegistered: registered.has(activity.id),
    }));
  }, [activities, info, session]);
  return <ActivitiesSection activities={items} />;
}
