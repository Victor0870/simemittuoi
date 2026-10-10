import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ScoreHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-xl text-center py-12 space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MaterialIcon className="text-[32px]" name="lock" />
        </div>
        <h1 className="text-headline-md font-bold text-[#173A67]">Xem Lịch Sử Điểm Của Bạn</h1>
        <p className="text-body-md text-on-surface-variant">
          Vui lòng đăng nhập để theo dõi chi tiết điểm tích lũy và các hoạt động thi đua bạn đã tham gia.
        </p>
        <Link
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-white shadow-xs hover:bg-dusty-dark transition"
          href="/login?next=/score-history"
        >
          <span>Đăng nhập ngay</span>
          <MaterialIcon name="arrow_forward" />
        </Link>
      </div>
    );
  }

  // 1. Profile
  const { data: profile } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("id, full_name, employee_code, department, total_score, rank, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  // 2. Score Events
  const { data: events } = await supabase
    .from(CDILV_TABLE.scoreEvents)
    .select("id, points, note, award_label, created_at, activity_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const scoreEvents = events ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Lịch Sử Điểm Tích Lũy</h1>
          <p className="text-body-md text-[#27496D]">
            Theo dõi chi tiết các lượt cộng thưởng điểm phong trào, thi đua và hoạt động công đoàn.
          </p>
        </div>

        <Link
          className="rounded-xl border border-outline-variant px-4 py-2 text-label-md font-bold text-[#173A67] hover:bg-surface-container-high transition"
          href="/leaderboard"
        >
          ← Xem Bảng xếp hạng
        </Link>
      </div>

      {/* Profile Overview Card */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-outline-variant bg-gradient-to-r from-surface-container-lowest via-white to-amber-50/40 p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-bold text-white text-xl shadow-xs shrink-0">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={profile.full_name}
                className="h-full w-full rounded-full object-cover"
                src={profile.avatar_url}
              />
            ) : (
              (profile?.full_name || "?").slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <h2 className="text-headline-sm font-extrabold text-[#173A67]">{profile?.full_name || "Đoàn viên"}</h2>
            <p className="text-body-sm text-on-surface-variant">
              Mã NV: <strong>{profile?.employee_code || "—"}</strong> · Bộ phận: <strong>{profile?.department || "—"}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 rounded-xl border border-outline-variant bg-white px-6 py-3 shadow-2xs">
          <div className="text-center">
            <p className="text-label-sm text-on-surface-variant">Tổng điểm tích lũy</p>
            <p className="text-headline-md font-black text-amber-700">{profile?.total_score ?? 0} đ</p>
          </div>
          <div className="h-10 w-px bg-outline-variant" />
          <div className="text-center">
            <p className="text-label-sm text-on-surface-variant">Thứ hạng hiện tại</p>
            <p className="text-headline-md font-bold text-[#173A67]">#{profile?.rank ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Score Events List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MaterialIcon className="text-[22px] text-primary" name="receipt_long" />
          <h2 className="text-title-lg font-bold text-[#173A67]">Chi tiết các lượt biến động điểm</h2>
        </div>

        {scoreEvents.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 text-center space-y-2">
            <MaterialIcon className="text-[36px] text-on-surface-variant/50" name="info" />
            <p className="text-body-md text-on-surface-variant">
              Bạn chưa có lượt cộng điểm nào. Hãy tham gia các hoạt động công đoàn để tích lũy điểm thi đua!
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xs">
            <div className="divide-y divide-outline-variant">
              {scoreEvents.map((evt) => {
                const isPositive = evt.points >= 0;
                const formattedTime = new Date(evt.created_at).toLocaleString("vi-VN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });

                return (
                  <div key={evt.id} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 hover:bg-surface-container-low/50 transition">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold ${
                          isPositive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-error/15 text-error"
                        }`}
                      >
                        <MaterialIcon name={isPositive ? "arrow_upward" : "arrow_downward"} />
                      </div>
                      <div>
                        <p className="font-bold text-[#173A67] text-body-md">
                          {evt.note || "Cộng điểm hoạt động"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant mt-0.5">
                          <span>{formattedTime}</span>
                          {evt.award_label ? (
                            <>
                              <span>·</span>
                              <span className="rounded-md bg-surface-container-high px-1.5 py-0.5 font-medium">
                                {evt.award_label}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-title-md font-black ${
                          isPositive ? "text-emerald-700" : "text-error"
                        }`}
                      >
                        {isPositive ? `+${evt.points}` : evt.points} điểm
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
