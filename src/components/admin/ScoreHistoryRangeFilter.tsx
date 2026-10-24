"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { HISTORY_FROM_ALL, historyPresets, type ScoreHistoryFrom } from "@/components/admin/scoreHistoryRange";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export function ScoreHistoryRangeFilter({ from, today }: { from: ScoreHistoryFrom; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(next: ScoreHistoryFrom) {
    if (next === from) return;
    startTransition(() => {
      router.replace(`/admin/scores/history?from=${next}`, { scroll: false });
    });
  }

  return (
    <div aria-busy={pending} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
      <label className="flex items-center gap-1.5 font-semibold text-[#173A67]">
        <span>Từ ngày</span>
        <input
          className="rounded-lg border border-[#d2dfe9] bg-white px-2 py-1 text-xs text-on-surface focus:border-[#4a6b82] disabled:opacity-60"
          disabled={pending}
          max={today}
          type="date"
          value={from === HISTORY_FROM_ALL ? "" : from}
          onChange={(e) => {
            if (e.target.value) navigate(e.target.value);
          }}
        />
      </label>
      <span className="text-on-surface-variant">đến Hiện tại</span>
      <div className="flex flex-wrap items-center gap-1">
        {historyPresets(today).map((p) => {
          const active = p.from === from;
          return (
            <button
              key={p.label}
              aria-pressed={active}
              className={`rounded-lg border px-2 py-1 font-semibold transition disabled:cursor-wait ${
                active
                  ? "border-[#4a6b82] bg-[#4a6b82] text-white"
                  : "border-[#d2dfe9] bg-white text-[#4a6b82] hover:bg-[#ecf4ff]"
              }`}
              disabled={pending}
              type="button"
              onClick={() => navigate(p.from)}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {pending ? (
        <span className="inline-flex items-center gap-1 text-on-surface-variant">
          <MaterialIcon className="animate-spin text-[16px]" name="progress_activity" />
          Đang tải...
        </span>
      ) : null}
    </div>
  );
}
