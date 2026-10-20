"use client";

import { useEffect, useState } from "react";
import {
  getNextPhaseChangeAt,
  getPollPhase,
  type PollPhase,
  type PollPhaseInput,
} from "@/lib/polls/phase";

const MAX_TIMEOUT = 2_147_000_000;

/**
 * Giai đoạn bình chọn tính theo đồng hồ máy người xem, tự chuyển khi tới giờ mở / giờ dừng.
 * `initialNow` lấy từ server để lần render đầu khớp HTML (tránh lệch hydrate).
 */
export function usePollPhase(poll: PollPhaseInput, initialNow: number): PollPhase {
  const [now, setNow] = useState(initialNow);
  const nextAt = getNextPhaseChangeAt(poll, now);

  useEffect(() => {
    setNow(Date.now());
    const refresh = () => setNow(Date.now());
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (nextAt === null) return;
    const delay = Math.min(Math.max(nextAt - Date.now() + 250, 250), MAX_TIMEOUT);
    const id = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(id);
  }, [nextAt, now]);

  return getPollPhase(poll, now);
}
