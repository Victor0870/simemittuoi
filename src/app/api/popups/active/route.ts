import { NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { isWithinDailyWindow, toClock, type ActivePopup } from "@/lib/popups";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";

const TONE_ORDER: Record<string, number> = { urgent: 0, warning: 1, info: 2, success: 3 };

/** Popup đang trong thời gian và khung giờ hiện, lọc theo đối tượng người xem. */
export async function GET() {
  const access = await getCurrentAccess();
  const isMember = Boolean(access?.isApproved);
  const nowIso = new Date().toISOString();

  const db = createServiceClient();
  let query = db
    .from(CDILV_TABLE.popups)
    .select("id, title, body, tone, link_url, link_label, frequency, starts_at, daily_start, daily_end")
    .eq("is_active", true)
    .lte("starts_at", nowIso)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
    .order("starts_at", { ascending: false })
    .limit(30);
  if (!isMember) query = query.eq("audience", "all");

  const { data: rows, error } = await query;
  if (error) {
    console.error("[popups] active error:", error.message);
    return NextResponse.json({ popups: [] });
  }
  const data = (rows ?? [])
    .filter((p) =>
      isWithinDailyWindow({ dailyStart: toClock(p.daily_start), dailyEnd: toClock(p.daily_end) }),
    )
    .slice(0, 10);

  const lastSeen = new Map<string, string>();
  if (access && data.length > 0) {
    const { data: views } = await db
      .from(CDILV_TABLE.popupViews)
      .select("popup_id, last_seen_at")
      .eq("user_id", access.userId)
      .in(
        "popup_id",
        data.map((p) => p.id),
      );
    for (const v of views ?? []) lastSeen.set(v.popup_id, v.last_seen_at);
  }

  const popups: ActivePopup[] = data
    .map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      tone: p.tone,
      linkUrl: p.link_url,
      linkLabel: p.link_label,
      frequency: p.frequency,
      lastSeenAt: lastSeen.get(p.id) ?? null,
    }))
    .sort((a, b) => (TONE_ORDER[a.tone] ?? 9) - (TONE_ORDER[b.tone] ?? 9));

  return NextResponse.json({ popups }, { headers: { "Cache-Control": "no-store" } });
}
