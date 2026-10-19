"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { LeaderboardEntry } from "@/lib/mock-data";
import { readableAwardLabel } from "@/lib/score-labels";

type MemberScoreEvent = {
  id: string;
  points: number;
  note: string | null;
  awardLabel: string | null;
  activityTitle?: string | null;
  createdAt: string;
};

type MemberDetails = {
  name: string;
  employeeCode: string | null;
  department: string | null;
  avatarUrl: string | null;
  totalScore: number;
  rank: number | null;
};

type MemberScoreHistoryModalProps = {
  member: LeaderboardEntry | null;
  isOpen: boolean;
  onClose: () => void;
  isGuest?: boolean;
};

function formatEventDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${hours}:${minutes} · ${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
}

export function MemberScoreHistoryModal({
  member,
  isOpen,
  onClose,
  isGuest = false,
}: MemberScoreHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<MemberDetails | null>(null);
  const [events, setEvents] = useState<MemberScoreEvent[]>([]);

  useEffect(() => {
    if (!isOpen || !member) {
      setDetails(null);
      setEvents([]);
      setError(null);
      return;
    }

    // Nếu là khách, không fetch API lịch sử
    if (isGuest) {
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const queryParams = new URLSearchParams();
    if (member.id) queryParams.set("id", member.id);
    if (member.employeeCode) queryParams.set("code", member.employeeCode);
    if (member.userId) queryParams.set("userId", member.userId);

    fetch(`/api/leaderboard/member-history?${queryParams.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Không thể tải lịch sử điểm");
        }
        return json;
      })
      .then((data) => {
        if (!isMounted) return;
        setDetails(data.member);
        setEvents(data.events || []);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err.message || "Đã có lỗi xảy ra");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, member, isGuest]);

  // Đóng modal khi nhấn ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border border-outline-variant bg-surface-container-lowest shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header bar with close button */}
        <div className="flex items-center justify-between border-b border-outline-variant/60 px-6 py-4 bg-surface-container-low/40">
          <div className="flex items-center gap-2 text-[#173A67]">
            <MaterialIcon className="text-[22px] text-amber-honor" filled name="history_edu" />
            <h3 className="font-extrabold text-title-md">
              {isGuest ? "Quyền xem lịch sử điểm" : "Lịch sử cộng điểm đoàn viên"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition active:scale-95"
            aria-label="Đóng"
          >
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isGuest ? (
            /* TRƯỜNG HỢP: KHÁCH CHƯA ĐĂNG NHẬP / CHƯA ĐĂNG KÝ */
            <div className="py-4 text-center space-y-5">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-700 shadow-inner">
                <MaterialIcon className="text-[40px]" filled name="lock" />
              </div>

              <div className="space-y-2">
                <h4 className="text-headline-sm font-extrabold text-[#173A67]">
                  Chỉ dành cho thành viên đã đăng ký
                </h4>
                <p className="text-body-md text-on-surface-variant max-w-md mx-auto">
                  Chi tiết minh chứng và lịch sử các lượt cộng điểm thi đua của đoàn viên{" "}
                  <strong className="text-on-surface font-semibold">
                    {member.name}
                  </strong>{" "}
                  được bảo vệ nội bộ. Vui lòng đăng nhập tài khoản đoàn viên để xem.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/login?next=/leaderboard"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#173A67] px-6 py-3 font-bold text-white shadow-xs hover:bg-dusty-dark transition active:scale-[0.98]"
                >
                  <MaterialIcon className="text-[20px]" name="login" />
                  <span>Đăng nhập ngay</span>
                </Link>

                <Link
                  href="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-bold text-[#173A67] hover:bg-surface-container-high transition active:scale-[0.98]"
                >
                  <span>Đăng ký tài khoản</span>
                </Link>
              </div>
            </div>
          ) : (
            /* TRƯỜNG HỢP: ĐÃ ĐĂNG NHẬP / THÀNH VIÊN ĐÃ ĐĂNG KÝ */
            <>
              {/* Member Overview Card */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-dusty-border/80 bg-gradient-to-br from-white via-surface-muted/40 to-amber-50/30 p-4 sm:p-5 shadow-2xs">
                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#173A67] to-dusty-dark text-white font-extrabold text-xl shadow-xs ring-2 ring-primary/20">
                      {member.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={member.name}
                          className="h-full w-full object-cover"
                          src={member.avatarUrl}
                        />
                      ) : (
                        member.name.trim().slice(0, 1).toUpperCase()
                      )}
                    </div>
                    {member.rank && member.rank <= 3 ? (
                      <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-amber-900 shadow-xs border border-white">
                        <MaterialIcon className="text-[14px]" filled name="crown" />
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <h4 className="text-title-lg font-extrabold text-[#173A67]">
                      {details?.name || member.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-label-sm text-on-surface-variant">
                      {(details?.employeeCode || member.employeeCode) ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-surface-container-high px-2 py-0.5 font-bold text-primary">
                          <MaterialIcon className="text-[13px]" name="badge" />
                          NV: {details?.employeeCode || member.employeeCode}
                        </span>
                      ) : null}
                      {(details?.department || member.department) ? (
                        <span className="inline-flex items-center gap-1 text-on-surface-variant">
                          • {details?.department || member.department}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Rank & Score Pill */}
                <div className="flex items-center gap-3 self-end sm:self-center bg-white/90 rounded-xl border border-dusty-border/70 p-2.5 shadow-2xs">
                  <div className="text-center px-2">
                    <span className="block text-[11px] font-medium text-on-surface-variant uppercase">
                      Thứ hạng
                    </span>
                    <span className="text-title-md font-black text-[#173A67]">
                      #{details?.rank ?? member.rank}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-outline-variant/60" />
                  <div className="text-center px-2">
                    <span className="block text-[11px] font-medium text-on-surface-variant uppercase">
                      Tổng điểm
                    </span>
                    <span className="text-title-md font-black text-amber-700">
                      {(details?.totalScore ?? member.score).toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                </div>
              </div>

              {/* Event List Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-title-sm text-[#173A67] flex items-center gap-1.5">
                    <MaterialIcon className="text-[18px] text-primary" name="military_tech" />
                    <span>Chi tiết các lượt cộng thưởng</span>
                  </h5>
                  {!loading && !error ? (
                    <span className="text-label-sm text-on-surface-variant">
                      {events.length} sự kiện
                    </span>
                  ) : null}
                </div>

                {loading ? (
                  /* Loading Skeletons */
                  <div className="space-y-2.5 py-2">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="animate-pulse rounded-2xl border border-outline-variant/40 bg-surface-muted/60 p-4 space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <div className="h-4 w-40 rounded bg-slate-200" />
                          <div className="h-6 w-16 rounded bg-slate-200" />
                        </div>
                        <div className="h-3 w-3/4 rounded bg-slate-200" />
                        <div className="h-3 w-28 rounded bg-slate-200" />
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  /* Error State */
                  <div className="rounded-2xl border border-error/20 bg-error-container/20 p-5 text-center space-y-2">
                    <p className="text-body-sm font-semibold text-on-error-container">{error}</p>
                    <button
                      onClick={() => {
                        setError(null);
                        setLoading(true);
                      }}
                      className="text-label-sm font-bold text-primary hover:underline"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : events.length === 0 ? (
                  /* Empty State */
                  <div className="rounded-2xl border border-dashed border-outline-variant/80 bg-surface-container-low/40 p-8 text-center space-y-2">
                    <MaterialIcon
                      className="text-[32px] text-on-surface-variant/60"
                      name="hourglass_empty"
                    />
                    <p className="text-body-md text-on-surface-variant font-medium">
                      Chưa có sự kiện cộng điểm nào được ghi nhận.
                    </p>
                  </div>
                ) : (
                  /* Events List */
                  <div className="space-y-2.5">
                    {events.map((evt) => {
                      const title = readableAwardLabel(evt.awardLabel) ?? evt.note ?? "Cộng điểm thi đua";
                      return (
                      <div
                        key={evt.id}
                        className="group flex items-start justify-between gap-3 rounded-2xl border border-dusty-border/60 bg-white p-3.5 transition-all hover:border-primary/50 hover:shadow-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100/70 text-amber-800">
                            <MaterialIcon
                              className="text-[20px]"
                              filled
                              name={
                                evt.points >= 40
                                  ? "workspace_premium"
                                  : evt.points >= 20
                                    ? "emoji_events"
                                    : "military_tech"
                              }
                            />
                          </div>

                          <div className="space-y-0.5">
                            <h6 className="font-extrabold text-body-md text-on-surface group-hover:text-primary transition-colors">
                              {title}
                            </h6>
                            {evt.note && evt.note !== title ? (
                              <p className="text-body-sm text-on-surface-variant leading-snug">
                                {evt.note}
                              </p>
                            ) : null}
                            {evt.activityTitle ? (
                              <p className="text-label-sm text-primary font-medium">
                                Hoạt động: {evt.activityTitle}
                              </p>
                            ) : null}
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-on-surface-variant/80">
                              <MaterialIcon className="text-[12px]" name="schedule" />
                              {formatEventDate(evt.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-300/80 px-2.5 py-1 text-label-md font-black text-amber-800 shadow-2xs">
                            +{evt.points} đ
                          </span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-outline-variant/60 px-6 py-3.5 bg-surface-container-low/40 flex items-center justify-between text-xs text-on-surface-variant">
          <span className="italic flex items-center gap-1">
            <MaterialIcon className="text-[14px] text-primary" name="verified_user" />
            Hệ thống thi đua Công đoàn CDILV
          </span>
          <button
            onClick={onClose}
            className="rounded-xl border border-outline-variant bg-white px-4 py-2 font-bold text-on-surface hover:bg-surface-container-high transition active:scale-95 text-label-md"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
