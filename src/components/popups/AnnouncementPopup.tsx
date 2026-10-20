"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PopupCard } from "@/components/popups/PopupCard";
import { isExternalLink, type ActivePopup } from "@/lib/popups";

const POLL_MS = 5 * 60_000;

/** Không chen popup vào các trang đăng nhập / quản trị / đang thi trắc nghiệm. */
const HIDDEN_PREFIXES = [
  "/admin",
  "/login",
  "/register",
  "/pending",
  "/auth/",
  "/forgot-password",
  "/reset-password",
  "/settings/password",
  "/quiz",
];

function storageKey(id: string) {
  return `cdilv_popup_${id}`;
}

function vnDate(value: string | number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function shouldShow(popup: ActivePopup): boolean {
  if (popup.frequency === "session") {
    return window.sessionStorage.getItem(storageKey(popup.id)) === null;
  }
  const localSeen = window.localStorage.getItem(storageKey(popup.id));
  const lastSeen = [popup.lastSeenAt, localSeen]
    .filter((v): v is string => Boolean(v))
    .sort()
    .pop();
  if (!lastSeen) return true;
  if (popup.frequency === "daily") return vnDate(lastSeen) !== vnDate(Date.now());
  return false;
}

/** Popup thông báo nhanh do Ban chấp hành đăng (quản lý tại /admin/popups). */
export function AnnouncementPopup() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { user, loading } = useAuth();
  const [popups, setPopups] = useState<ActivePopup[]>([]);
  const [closedIds, setClosedIds] = useState<Set<string>>(() => new Set());

  const userId = user?.id ?? null;

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/popups/active", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { popups?: ActivePopup[] };
        if (!cancelled) setPopups((data.popups ?? []).filter(shouldShow));
      } catch {
        // lỗi mạng: lần kiểm tra sau sẽ thử lại
      }
    }
    void load();
    const timer = window.setInterval(load, POLL_MS);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [loading, userId]);

  const queue = useMemo(() => popups.filter((p) => !closedIds.has(p.id)), [popups, closedIds]);
  const current = queue[0];
  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const dismiss = useCallback(
    (popup: ActivePopup) => {
      const now = new Date().toISOString();
      if (popup.frequency === "session") {
        window.sessionStorage.setItem(storageKey(popup.id), now);
      } else {
        window.localStorage.setItem(storageKey(popup.id), now);
      }
      setClosedIds((prev) => new Set(prev).add(popup.id));
      if (userId) {
        void fetch("/api/popups/seen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: popup.id }),
        }).catch(() => {});
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!current || hidden) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && current) dismiss(current);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, hidden, dismiss]);

  if (!current || hidden) return null;

  function openLink(popup: ActivePopup) {
    dismiss(popup);
    if (!popup.linkUrl) return;
    if (isExternalLink(popup.linkUrl)) {
      window.open(popup.linkUrl, "_blank", "noopener,noreferrer");
    } else {
      router.push(popup.linkUrl);
    }
  }

  return (
    <div
      aria-label={current.title}
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
    >
      <PopupCard
        popup={current}
        position={{ index: popups.length - queue.length + 1, total: popups.length }}
        onClose={() => dismiss(current)}
        onOpenLink={() => openLink(current)}
      />
    </div>
  );
}
