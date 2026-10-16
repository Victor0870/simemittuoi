"use client";

import type { ReactionCounts, ReactionType } from "@/lib/data/albums";

const REACTION_META: Record<
  ReactionType,
  { emoji: string; label: string; active: string; idle: string; badge: string }
> = {
  like: {
    emoji: "👍",
    label: "Thích",
    active: "border-blue-400 bg-blue-50 text-blue-700",
    idle: "hover:text-blue-600",
    badge: "bg-blue-200/80 text-blue-900",
  },
  heart: {
    emoji: "❤️",
    label: "Tim",
    active: "border-rose-400 bg-rose-50 text-rose-700",
    idle: "hover:text-rose-600",
    badge: "bg-rose-200/80 text-rose-900",
  },
  haha: {
    emoji: "😆",
    label: "Haha",
    active: "border-amber-400 bg-amber-50 text-amber-700",
    idle: "hover:text-amber-600",
    badge: "bg-amber-200/80 text-amber-900",
  },
};

type ReactionButtonsProps = {
  reactions: ReactionCounts;
  userReaction: ReactionType | null;
  disabled?: boolean;
  onReact: (type: ReactionType) => void;
};

export function ReactionButtons({ reactions, userReaction, disabled, onReact }: ReactionButtonsProps) {
  const total = reactions.like + reactions.heart + reactions.haha;

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {(Object.keys(REACTION_META) as ReactionType[]).map((type) => {
        const meta = REACTION_META[type];
        const isActive = userReaction === type;
        const count = reactions[type];

        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onReact(type)}
            title={meta.label}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all disabled:opacity-60 sm:px-3 ${
              isActive
                ? `${meta.active} scale-105 font-bold shadow-2xs`
                : `border-dusty-border/70 bg-surface-container-lowest text-on-surface-variant hover:bg-dusty-light ${meta.idle}`
            }`}
          >
            <span className="text-[14px]">{meta.emoji}</span>
            <span>{meta.label}</span>
            {count > 0 && (
              <span
                className={`ml-0.5 rounded-full px-1.5 text-[11px] ${
                  isActive ? `${meta.badge} font-bold` : "bg-dusty-light font-semibold text-on-surface"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}

      {total > 0 && (
        <span className="ml-auto text-[11px] font-medium text-on-surface-variant/70">
          {total} tương tác
        </span>
      )}
    </div>
  );
}
