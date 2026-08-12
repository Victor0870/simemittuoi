import Image from "next/image";
import type { LeaderboardEntry } from "@/lib/mock-data";

type LeaderboardRowProps = {
  entry: LeaderboardEntry;
};

export function LeaderboardRow({ entry }: LeaderboardRowProps) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl p-3 transition-colors ${
        entry.isTop
          ? "bg-surface-container hover:bg-surface-container-high"
          : "hover:bg-surface-container-high"
      }`}
    >
      <div className="relative">
        <div
          className={`h-12 w-12 overflow-hidden rounded-full border-2 ${
            entry.isTop ? "border-primary" : "border-outline-variant"
          }`}
        >
          <Image
            alt={entry.name}
            className="h-full w-full object-cover"
            height={48}
            src={entry.avatarUrl}
            width={48}
          />
        </div>
        <span
          className={`absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            entry.isTop
              ? "bg-primary text-on-primary"
              : "bg-outline text-white"
          }`}
        >
          {entry.rank}
        </span>
      </div>

      <div className="flex-1">
        <p className="font-bold text-on-surface">{entry.name}</p>
        <p className="text-xs text-on-surface-variant">{entry.department}</p>
      </div>

      <p className="font-extrabold text-primary">
        {entry.score.toLocaleString("vi-VN")}
      </p>
    </div>
  );
}
