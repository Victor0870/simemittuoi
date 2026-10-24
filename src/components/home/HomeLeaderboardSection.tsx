"use client";

import { useState } from "react";
import Link from "next/link";
import { LeaderboardRow } from "@/components/home/LeaderboardRow";
import { LeaderboardPodium } from "@/components/leaderboard/LeaderboardPodium";
import { MemberScoreHistoryModal } from "@/components/leaderboard/MemberScoreHistoryModal";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { LeaderboardEntry } from "@/lib/mock-data";
import { RANKING_UPDATE_NOTE } from "@/lib/ranking-cache";

type HomeLeaderboardSectionProps = {
  entries: LeaderboardEntry[];
  maskIdentity?: boolean;
  /** Chưa biết người xem đã đăng nhập hay chưa: hiện khung chờ thay cho tên (che hoặc đầy đủ). */
  identityPending?: boolean;
};

export function HomeLeaderboardSection({
  entries,
  maskIdentity = false,
  identityPending = false,
}: HomeLeaderboardSectionProps) {
  const [selectedMember, setSelectedMember] = useState<LeaderboardEntry | null>(null);
  const nextThree = entries.filter((entry) => entry.rank > 3).slice(0, 3);

  return (
    <section className="space-y-6" id="vinh-danh">
      <div className="flex flex-col justify-between gap-3 border-b border-dusty-border/70 pb-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-amber-light p-2 font-bold text-amber-800">
            <MaterialIcon
              className="text-[24px] text-amber-honor"
              filled
              name="military_tech"
            />
          </div>
          <div>
            <h2 className="text-headline-lg tracking-tight text-on-surface">
              BỤC VINH DANH
            </h2>
            <p className="text-body-sm text-on-surface-variant">
              Tuyên dương các đoàn viên xuất sắc
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-dusty-border bg-white px-3 py-1 text-label-md text-primary">
          <MaterialIcon className="text-[16px]" name="schedule" />
          {RANKING_UPDATE_NOTE}
        </span>
      </div>

      {identityPending ? (
        <div aria-busy="true" className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
          <div className="grid h-64 animate-pulse grid-cols-3 items-end gap-3 rounded-2xl border border-dusty-border/60 bg-surface-container-lowest p-6 lg:col-span-7 xl:col-span-8">
            <div className="h-2/3 rounded-xl bg-dusty-border/40" />
            <div className="h-full rounded-xl bg-dusty-border/50" />
            <div className="h-1/2 rounded-xl bg-dusty-border/40" />
          </div>
          <div className="animate-pulse space-y-3 rounded-2xl border border-dusty-border/80 bg-surface-container-lowest p-6 lg:col-span-5 xl:col-span-4">
            <div className="h-6 w-40 rounded bg-dusty-border/50" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-dusty-border/40" />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
          <div className="lg:col-span-7 xl:col-span-8">
            <LeaderboardPodium
              entries={entries}
              maskIdentity={maskIdentity}
              variant="home"
              onSelectMember={setSelectedMember}
            />
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-dusty-border/80 bg-surface-container-lowest p-6 shadow-sm lg:col-span-5 xl:col-span-4">
            <div>
              <div className="flex items-center justify-between border-b border-dusty-border/70 pb-4">
                <div>
                  <h3 className="text-headline-sm font-bold text-on-surface">
                    Tiếp theo trên bảng
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">
                    Vị trí kế tiếp sau bục vinh danh
                  </p>
                </div>
                <MaterialIcon
                  className="text-[24px] text-primary"
                  name="format_list_numbered"
                />
              </div>

              {maskIdentity ? (
                <div className="my-4 flex items-start gap-2 rounded-lg border border-dusty-border/70 bg-surface-muted p-2.5 text-body-sm text-on-surface-variant">
                  <MaterialIcon
                    className="mt-0.5 shrink-0 text-[18px] text-primary"
                    name="info"
                  />
                  <span>
                    Khách chỉ xem điểm tóm tắt. Đăng nhập đoàn viên để xem thống kê
                    minh chứng chi tiết.
                  </span>
                </div>
              ) : (
                <div className="my-4" />
              )}

              {nextThree.length > 0 ? (
                <div className="space-y-3">
                  {nextThree.map((entry) => (
                    <LeaderboardRow
                      key={entry.id}
                      entry={entry}
                      maskIdentity={maskIdentity}
                      onSelectMember={setSelectedMember}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-surface-muted px-4 py-6 text-center text-sm text-on-surface-variant">
                  Chưa có thêm người trong bảng xếp hạng.
                </p>
              )}
            </div>

            <div className="mt-6 border-t border-dusty-border/70 pt-4">
              <Link
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary py-2.5 px-4 text-label-lg font-bold text-primary shadow-xs transition-all hover:bg-primary hover:text-white active:scale-[0.98]"
                href="/leaderboard"
              >
                <MaterialIcon className="text-[18px]" name="visibility" />
                Xem bảng xếp hạng đầy đủ
              </Link>
            </div>
          </div>
        </div>
      )}

      <MemberScoreHistoryModal
        member={selectedMember}
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        isGuest={maskIdentity}
      />
    </section>
  );
}
