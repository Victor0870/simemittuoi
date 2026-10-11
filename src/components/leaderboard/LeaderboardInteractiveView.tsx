"use client";

import { useState } from "react";
import { LeaderboardPodium } from "@/components/leaderboard/LeaderboardPodium";
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList";
import { MemberScoreHistoryModal } from "@/components/leaderboard/MemberScoreHistoryModal";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { LeaderboardEntry } from "@/lib/mock-data";

type LeaderboardInteractiveViewProps = {
  visibleEntries: LeaderboardEntry[];
  restEntries: LeaderboardEntry[];
  highlightId: string | null;
  isGuest: boolean;
  tab: "10" | "45";
};

export function LeaderboardInteractiveView({
  visibleEntries,
  restEntries,
  highlightId,
  isGuest,
  tab,
}: LeaderboardInteractiveViewProps) {
  const [selectedMember, setSelectedMember] = useState<LeaderboardEntry | null>(null);

  return (
    <>
      <LeaderboardPodium
        entries={visibleEntries}
        maskIdentity={isGuest}
        onSelectMember={setSelectedMember}
      />

      <section className="tonal-elevation-1 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-headline-md text-primary font-bold">
              {tab === "45" ? "Hạng 4 – 45" : "Hạng 4 – 10"}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Danh sách tiếp theo sau bục trao huy chương (bấm vào tên để xem lịch sử điểm)
            </p>
          </div>
          <MaterialIcon
            className="text-[#173A67] material-symbols-filled"
            filled
            name="format_list_numbered"
          />
        </div>

        <LeaderboardList
          entries={restEntries}
          highlightId={highlightId}
          maskIdentity={isGuest}
          onSelectMember={setSelectedMember}
        />
      </section>

      <MemberScoreHistoryModal
        member={selectedMember}
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        isGuest={isGuest}
      />
    </>
  );
}
