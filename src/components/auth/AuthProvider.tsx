"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type UserProfile = {
  id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  role: string;
  approval_status: string;
  avatar_url: string | null;
  total_score?: number;
  rank?: number | null;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  isGuest: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isApproved: false,
  isGuest: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedUserIdRef = useRef<string | null | undefined>(undefined);

  async function loadProfile(u: User | null) {
    loadedUserIdRef.current = u?.id ?? null;
    if (!u) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setUser(u);
    const supabase = createClient();
    try {
      const { data } = await supabase
        .from(CDILV_TABLE.profiles)
        .select("id, full_name, employee_code, department, role, approval_status, avatar_url, total_score, rank")
        .eq("id", u.id)
        .maybeSingle();

      setProfile(data as UserProfile | null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      const sameUser =
        loadedUserIdRef.current !== undefined &&
        loadedUserIdRef.current === (nextUser?.id ?? null);
      if (sameUser && event !== "USER_UPDATED") return;
      loadedUserIdRef.current = nextUser?.id ?? null;
      // Không gọi Supabase trực tiếp trong callback để tránh khóa auth (deadlock)
      setTimeout(() => {
        if (!cancelled) void loadProfile(nextUser);
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const isApproved = profile?.approval_status === "approved";
    const isAdmin = isApproved && profile?.role === "admin";
    const isGuest = !user || !isApproved;

    return {
      user,
      profile,
      loading,
      isAdmin,
      isApproved,
      isGuest,
      refreshProfile: async () => {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        await loadProfile(data.user);
      },
    };
  }, [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
