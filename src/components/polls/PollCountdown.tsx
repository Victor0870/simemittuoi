"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/polls/phase";

type Props = {
  target: string;
  className?: string;
};

export function PollCountdown({ target, className }: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = now === null ? null : new Date(target).getTime() - now;
  return (
    <span className={className} suppressHydrationWarning>
      {remaining === null ? "--:--:--" : formatCountdown(remaining)}
    </span>
  );
}
