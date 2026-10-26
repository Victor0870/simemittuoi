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
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";
import {
  EMPTY_ACCESS,
  canAccessAdminPath,
  hasPermission,
  parseAccess,
  type AccessInfo,
  type AccessRole,
  type PermissionCode,
} from "@/lib/auth/permissions";

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
  /** Các cấp được admin gán (Manager, Kế toán…). */
  roles: AccessRole[];
  /** Có ít nhất một quyền quản lý (admin luôn true). */
  hasAnyPermission: boolean;
  can: (code: PermissionCode) => boolean;
  /** Mở được trang /admin này không (cùng quy tắc với middleware). */
  canOpenAdmin: (pathname: string) => boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isApproved: false,
  isGuest: true,
  roles: [],
  hasAnyPermission: false,
  can: () => false,
  canOpenAdmin: () => false,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [access, setAccess] = useState<AccessInfo>(EMPTY_ACCESS);
  const [loading, setLoading] = useState(true);
  const loadedUserIdRef = useRef<string | null | undefined>(undefined);

  async function loadProfile(u: User | null) {
    loadedUserIdRef.current = u?.id ?? null;
    if (!u) {
      setUser(null);
      setProfile(null);
      setAccess(EMPTY_ACCESS);
      setLoading(false);
      return;
    }

    setUser(u);
    const supabase = createClient();
    try {
      const [{ data }, { data: accessData }] = await Promise.all([
        supabase
          .from(CDILV_TABLE.profiles)
          .select("id, full_name, employee_code, department, role, approval_status, avatar_url, total_score, rank")
          .eq("id", u.id)
          .maybeSingle(),
        supabase.rpc(CDILV_RPC.myPermissions),
      ]);

      setProfile(data as UserProfile | null);
      setAccess(parseAccess(accessData));
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
    const effectiveAccess: AccessInfo = { ...access, isAdmin, isApproved };

    return {
      user,
      profile,
      loading,
      isAdmin,
      isApproved,
      isGuest,
      roles: isApproved ? access.roles : [],
      hasAnyPermission: isApproved && (isAdmin || access.permissions.length > 0),
      can: (code) => hasPermission(effectiveAccess, code),
      canOpenAdmin: (pathname) => canAccessAdminPath(effectiveAccess, pathname),
      refreshProfile: async () => {
        const supabase = createClient();
        // getSession() đọc phiên đã lưu, không gọi mạng như getUser()
        const { data } = await supabase.auth.getSession();
        await loadProfile(data.session?.user ?? null);
      },
    };
  }, [user, profile, access, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
