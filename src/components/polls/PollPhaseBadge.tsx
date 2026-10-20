"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { POLL_PHASE_META, type PollPhaseInput } from "@/lib/polls/phase";
import { usePollPhase } from "@/components/polls/usePollPhase";

type Props = {
  poll: PollPhaseInput;
  initialNow: number;
};

export function PollPhaseBadge({ poll, initialNow }: Props) {
  const phase = usePollPhase(poll, initialNow);
  const meta = POLL_PHASE_META[phase];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-bold ${meta.chip}`}
    >
      {phase === "open" ? (
        <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-600 animate-pulse" />
      ) : (
        <MaterialIcon className="text-[14px]" name={meta.icon} />
      )}
      {meta.label}
    </span>
  );
}
