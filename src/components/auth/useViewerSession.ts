"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

/** unknown: chưa biết (hiện khung chờ); guest: chắc chắn chưa đăng nhập; member: có phiên đăng nhập. */
export type ViewerSessionState = "unknown" | "guest" | "member";

/** Cookie phiên của @supabase/ssr (sb-<ref>-auth-token, có thể chia nhỏ .0 .1…). Không có = chắc chắn là khách. */
export function hasSupabaseAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(document.cookie);
}

/**
 * Trạng thái đăng nhập của người xem, biết sớm nhất có thể:
 * - không có cookie phiên → khách ngay khi trang chạy;
 * - Supabase phía trình duyệt đã khôi phục được phiên → thành viên (không đợi tải hồ sơ);
 * - AuthProvider tải xong mà không có phiên → khách.
 */
export function useViewerSession(): ViewerSessionState {
  const { user, loading } = useAuth();
  const [hasCookie, setHasCookie] = useState<boolean | null>(null);

  useEffect(() => {
    setHasCookie(hasSupabaseAuthCookie());
  }, []);

  if (user) return "member";
  if (!loading || hasCookie === false) return "guest";
  return "unknown";
}

type ViewerFetchState<T> = { loading: boolean; data: T | null };

/**
 * Tải dữ liệu riêng của người xem (API no-store) ngay khi trang chạy nếu có cookie phiên,
 * song song với AuthProvider thay vì đợi nó xong. Khách không gọi API.
 */
export function useViewerFetch<T>(
  url: string,
  isGuestResult: (data: T) => boolean,
): { session: ViewerSessionState; loading: boolean; data: T | null } {
  const { user } = useAuth();
  const session = useViewerSession();
  const uid = user?.id ?? null;
  const [state, setState] = useState<ViewerFetchState<T>>({ loading: true, data: null });
  const requestIdRef = useRef(0);
  /** Dữ liệu hiện tại thuộc về ai: null = chưa tải, "?" = tải sớm trước khi biết user id. */
  const ownerRef = useRef<string | null>(null);
  const retriedRef = useRef(false);

  const load = useCallback(
    (owner: string) => {
      const id = ++requestIdRef.current;
      ownerRef.current = owner;
      setState((prev) => ({ loading: true, data: prev.data }));
      fetch(url, { cache: "no-store", credentials: "same-origin" })
        .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
        .catch(() => null)
        .then((data) => {
          if (requestIdRef.current === id) setState({ loading: false, data });
        });
    },
    [url],
  );

  useEffect(() => {
    if (session === "guest") {
      requestIdRef.current++;
      ownerRef.current = null;
      setState({ loading: false, data: null });
      return;
    }
    if (session === "unknown") {
      if (ownerRef.current === null && hasSupabaseAuthCookie()) load("?");
      return;
    }
    if (!uid) return;
    if (ownerRef.current === "?") {
      ownerRef.current = uid;
      return;
    }
    if (ownerRef.current !== uid) {
      retriedRef.current = false;
      load(uid);
    }
  }, [session, uid, load]);

  // Máy chủ trả "khách" hoặc lỗi trong khi trình duyệt có phiên (vd. đang làm mới token): thử lại 1 lần
  useEffect(() => {
    if (session !== "member" || !uid || state.loading || retriedRef.current) return;
    if (state.data && !isGuestResult(state.data)) return;
    retriedRef.current = true;
    load(uid);
  }, [session, uid, state, isGuestResult, load]);

  return {
    session,
    loading: session === "unknown" || (session === "member" && state.loading),
    data: session === "guest" ? null : state.data,
  };
}
