"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";
import { startVisiblePolling } from "@/lib/visible-polling";

export type NotificationItem = {
  id: string;
  type:
    | "new_post"
    | "comment_reaction"
    | "user_approved"
    | "new_comment"
    | "new_album"
    | "album_new_photos"
    | "album_comment"
    | "comment_reply"
    | "photo_reaction"
    | "life_event_new"
    | "life_event_ack"
    | "visit_new"
    | "visit_decided"
    | "payment_new"
    | "payment_decided"
    | "password_reset_request"
    | "savings_maturity"
    | "system"
    | string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  timeAgo: string;
};

export function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [fetching, setFetching] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Chỉ áp dụng phản hồi của lần tải mới nhất (poll, focus và mở chuông có thể chồng nhau khi mạng chậm)
  const requestSeq = useRef(0);

  // Tải danh sách thông báo; số chưa đọc luôn tính cùng danh sách trong một phản hồi
  async function fetchNotifications() {
    if (!user) return;
    const seq = ++requestSeq.current;
    setFetching(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data?.notifications)) throw new Error("Phản hồi thông báo không hợp lệ");
      if (seq !== requestSeq.current) return;
      const list = data.notifications as NotificationItem[];
      const unreadInList = list.filter((n) => !n.is_read).length;
      setNotifications(list);
      setUnreadCount(list.length === 0 ? 0 : Math.max(Number(data.unreadCount) || 0, unreadInList));
      setLoadError(false);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error("Lỗi khi tải thông báo:", err);
      setLoadError(true);
    } finally {
      if (seq === requestSeq.current) setFetching(false);
    }
  }

  useEffect(() => {
    if (!user) {
      requestSeq.current++;
      setNotifications([]);
      setUnreadCount(0);
      setFetching(false);
      setLoadError(false);
      return;
    }

    // Kiểm tra thông báo mới mỗi 3 phút hoặc khi người dùng quay lại tab; tạm dừng khi tab bị ẩn
    return startVisiblePolling(fetchNotifications, 180000, { refetchOnFocus: true });
  }, [user]);

  // Đóng dropdown khi bấm ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Đánh dấu tất cả là đã đọc
  async function markAllAsRead() {
    if (unreadCount === 0) return;

    // Optimistic update; bỏ qua phản hồi tải cũ đang chờ để không hiện lại trạng thái chưa đọc
    requestSeq.current++;
    setFetching(false);
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch (err) {
      console.error("Lỗi mark all read:", err);
    }
  }

  // Đánh dấu 1 thông báo là đã đọc và điều hướng
  async function handleNotificationClick(item: NotificationItem) {
    if (!item.is_read) {
      requestSeq.current++;
      setFetching(false);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
      );

      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      }).catch(console.error);
    }

    setOpen(false);

    if (item.link) {
      router.push(item.link);
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case "new_post":
        return {
          name: "newspaper",
          bg: "bg-blue-100 text-blue-700",
        };
      case "comment_reaction":
        return {
          name: "favorite",
          bg: "bg-rose-100 text-rose-700",
        };
      case "user_approved":
        return {
          name: "verified",
          bg: "bg-emerald-100 text-emerald-800",
        };
      case "new_comment":
      case "album_comment":
        return {
          name: "forum",
          bg: "bg-amber-100 text-amber-800",
        };
      case "comment_reply":
        return {
          name: "reply",
          bg: "bg-sky-100 text-sky-800",
        };
      case "new_album":
      case "album_new_photos":
        return {
          name: "photo_library",
          bg: "bg-indigo-100 text-indigo-700",
        };
      case "photo_reaction":
        return {
          name: "favorite",
          bg: "bg-rose-100 text-rose-700",
        };
      case "life_event_new":
        return {
          name: "campaign",
          bg: "bg-amber-100 text-amber-800",
        };
      case "life_event_ack":
        return {
          name: "task_alt",
          bg: "bg-emerald-100 text-emerald-800",
        };
      case "visit_new":
        return {
          name: "volunteer_activism",
          bg: "bg-sky-100 text-sky-800",
        };
      case "visit_decided":
        return {
          name: "fact_check",
          bg: "bg-emerald-100 text-emerald-800",
        };
      case "payment_new":
        return {
          name: "request_quote",
          bg: "bg-sky-100 text-sky-800",
        };
      case "payment_decided":
        return {
          name: "price_check",
          bg: "bg-emerald-100 text-emerald-800",
        };
      case "password_reset_request":
        return {
          name: "lock_reset",
          bg: "bg-amber-100 text-amber-800",
        };
      case "savings_maturity":
        return {
          name: "savings",
          bg: "bg-amber-100 text-amber-800",
        };
      default:
        return {
          name: "notifications",
          bg: "bg-primary/10 text-primary",
        };
    }
  }

  if (!user) return null;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Nút chuông thông báo */}
      <button
        aria-label="Thông báo"
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) fetchNotifications();
        }}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
          open
            ? "bg-primary/10 text-primary"
            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        }`}
      >
        <MaterialIcon className="text-[22px]" name="notifications" />

        {/* Badge số lượng thông báo chưa đọc */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Menu thả xuống (Dropdown) */}
      {open && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[380px] max-w-[calc(100vw-20px)] overflow-hidden rounded-2xl border border-dusty-border/80 bg-white shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header dropdown */}
          <div className="flex items-center justify-between border-b border-dusty-border/60 bg-slate-50/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-on-surface text-title-sm sm:text-title-md">
                Thông báo
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-label-xs font-bold text-red-800">
                  {unreadCount} mới
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[12px] font-semibold text-primary hover:text-dusty-dark transition-colors"
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {/* Danh sách thông báo */}
          <div className="max-h-[380px] divide-y divide-dusty-border/40 overflow-y-auto">
            {loadError && notifications.length > 0 && !fetching ? (
              <div className="flex items-center justify-between gap-2 bg-amber-50 px-4 py-2 text-[12px] text-amber-900">
                <span>Không tải được thông báo mới nhất.</span>
                <button
                  type="button"
                  onClick={() => fetchNotifications()}
                  className="font-semibold text-primary hover:text-dusty-dark"
                >
                  Thử lại
                </button>
              </div>
            ) : null}
            {notifications.length === 0 && fetching ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center" role="status">
                <span className="mb-2.5 h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <p className="text-body-sm font-semibold text-on-surface">Đang tải thông báo…</p>
              </div>
            ) : notifications.length === 0 && loadError ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center" role="alert">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700 mb-2.5">
                  <MaterialIcon className="text-[26px]" name="error" />
                </div>
                <p className="text-body-sm font-semibold text-on-surface">Không tải được thông báo</p>
                <p className="text-label-xs text-on-surface-variant mt-0.5">Kết nối chậm hoặc bị gián đoạn.</p>
                <button
                  type="button"
                  onClick={() => fetchNotifications()}
                  className="mt-3 rounded-full border border-primary/30 px-3 py-1 text-[12px] font-semibold text-primary hover:bg-primary/5"
                >
                  Thử lại
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-dusty-light text-primary mb-2.5">
                  <MaterialIcon className="text-[26px]" name="notifications_off" />
                </div>
                <p className="text-body-sm font-semibold text-on-surface">
                  Chưa có thông báo nào
                </p>
                <p className="text-label-xs text-on-surface-variant mt-0.5">
                  Các thông báo bài viết mới, tương tác bình luận sẽ xuất hiện tại đây.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const iconInfo = getIcon(item.type);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`group flex items-start gap-3 p-3.5 sm:p-4 cursor-pointer transition-colors ${
                      !item.is_read
                        ? "bg-primary/[0.04] hover:bg-primary/[0.08]"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {/* Icon loại thông báo */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconInfo.bg}`}
                    >
                      <MaterialIcon className="text-[18px]" name={iconInfo.name} />
                    </div>

                    {/* Nội dung thông báo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-xs sm:text-body-sm truncate ${
                            !item.is_read
                              ? "font-bold text-on-surface"
                              : "font-semibold text-on-surface/90"
                          }`}
                        >
                          {item.title}
                        </p>
                        {!item.is_read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>

                      <p className="mt-0.5 text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>

                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-on-surface-variant/70">
                        <MaterialIcon className="text-[12px]" name="schedule" />
                        <span>{item.timeAgo}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
