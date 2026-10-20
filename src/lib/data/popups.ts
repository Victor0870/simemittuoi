import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import { popupImageUrl, toClock, type AdminPopup, type PopupAudience, type PopupFrequency, type PopupTone } from "@/lib/popups";

type PopupRow = {
  id: string;
  title: string;
  body: string;
  image_path: string | null;
  tone: PopupTone;
  link_url: string | null;
  link_label: string | null;
  audience: PopupAudience;
  frequency: PopupFrequency;
  starts_at: string;
  ends_at: string | null;
  daily_start: string | null;
  daily_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  creator: { full_name: string | null } | null;
};

/** Danh sách popup cho trang quản lý (mới nhất trước), kèm số người đã xem. */
export async function getAdminPopups(): Promise<AdminPopup[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from(CDILV_TABLE.popups)
    .select(
      "id, title, body, image_path, tone, link_url, link_label, audience, frequency, starts_at, ends_at, daily_start, daily_end, is_active, created_at, updated_at, creator:created_by(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as PopupRow[];
  const viewerCount = new Map<string, number>();
  if (rows.length > 0) {
    const { data: views } = await db
      .from(CDILV_TABLE.popupViews)
      .select("popup_id")
      .in(
        "popup_id",
        rows.map((r) => r.id),
      );
    for (const v of views ?? []) {
      viewerCount.set(v.popup_id, (viewerCount.get(v.popup_id) ?? 0) + 1);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    imagePath: r.image_path,
    imageUrl: popupImageUrl(r.image_path),
    tone: r.tone,
    linkUrl: r.link_url,
    linkLabel: r.link_label,
    audience: r.audience,
    frequency: r.frequency,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    dailyStart: toClock(r.daily_start),
    dailyEnd: toClock(r.daily_end),
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdByName: r.creator?.full_name ?? null,
    viewerCount: viewerCount.get(r.id) ?? 0,
  }));
}
