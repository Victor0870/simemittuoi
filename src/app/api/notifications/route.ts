import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hôm qua";
  return `${days} ngày trước`;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const publicDb = createServiceClient();

    const [notifResult, countResult] = await Promise.all([
      publicDb
        .from(CDILV_TABLE.notifications)
        .select("id, type, title, message, link, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      publicDb
        .from(CDILV_TABLE.notifications)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false),
    ]);

    if (notifResult.error) {
      console.error("[api/notifications] GET error:", notifResult.error.message);
      return NextResponse.json(
        { error: notifResult.error.message },
        { status: 500 },
      );
    }

    const notifications = (notifResult.data ?? []).map((n) => ({
      ...n,
      timeAgo: formatTimeAgo(n.created_at),
    }));

    return NextResponse.json({
      notifications,
      unreadCount: countResult.count ?? 0,
    });
  } catch (err: any) {
    console.error("[api/notifications] GET fatal:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi máy chủ." },
      { status: 500 },
    );
  }
}
