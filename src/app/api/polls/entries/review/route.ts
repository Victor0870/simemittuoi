import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { invalidatePollResults } from "@/lib/data/ranking-refresh";
import { loadEntries } from "@/lib/polls/entries-server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";

/** Danh sách bài người chơi nộp (mọi trạng thái) và bài chưa duyệt của chương trình. */
export async function GET(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.pollsManage);
    if (guard.response) return guard.response;

    const pollId = request.nextUrl.searchParams.get("pollId")?.trim();
    if (!pollId) return NextResponse.json({ error: "Thiếu ID chương trình." }, { status: 400 });

    const db = createServiceClient();
    const { data, error } = await db
      .from(CDILV_TABLE.pollOptions)
      .select("id, title, description, image_urls, approval_status, review_note, submitted_at, reviewed_at, submitted_by")
      .eq("poll_id", pollId)
      .or("approval_status.neq.approved,submitted_by.not.is.null")
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) throw error;

    return NextResponse.json({ entries: await loadEntries(db, data ?? []) });
  } catch (err: any) {
    console.error("[api/polls/entries/review] GET error:", err);
    return NextResponse.json({ error: err?.message || "Không tải được danh sách bài nộp." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission(PERMISSIONS.pollsManage);
    if (guard.response) return guard.response;

    const body = await request.json().catch(() => ({}));
    const optionId = String(body?.optionId ?? "").trim();
    const action = body?.action === "approve" ? "approve" : body?.action === "reject" ? "reject" : null;
    const reason = String(body?.reason ?? "").trim();
    if (!optionId || !action) {
      return NextResponse.json({ error: "Thiếu bài dự thi hoặc thao tác." }, { status: 400 });
    }
    if (action === "reject" && !reason) {
      return NextResponse.json({ error: "Vui lòng nhập lý do từ chối." }, { status: 400 });
    }
    if (reason.length > 500) {
      return NextResponse.json({ error: "Lý do tối đa 500 ký tự." }, { status: 400 });
    }

    const db = createServiceClient();
    const fromStatuses = action === "approve" ? ["pending", "rejected"] : ["pending"];
    const { data: updated, error } = await db
      .from(CDILV_TABLE.pollOptions)
      .update({
        approval_status: action === "approve" ? "approved" : "rejected",
        review_note: action === "approve" ? null : reason,
        reviewed_by: guard.access.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", optionId)
      .in("approval_status", fromStatuses)
      .select("id, poll_id");
    if (error) throw error;
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        {
          error:
            action === "approve"
              ? "Chỉ duyệt được bài đang chờ duyệt hoặc đã bị từ chối."
              : "Chỉ từ chối được bài đang chờ duyệt.",
        },
        { status: 400 },
      );
    }

    const pollId = String(updated[0].poll_id);
    try {
      invalidatePollResults(pollId);
      revalidatePath(`/polls/${pollId}`);
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      message: action === "approve" ? "Đã duyệt bài, bài đã hiện trong danh sách bình chọn." : "Đã từ chối bài.",
    });
  } catch (err: any) {
    console.error("[api/polls/entries/review] POST error:", err);
    return NextResponse.json({ error: err?.message || "Không cập nhật được bài." }, { status: 500 });
  }
}
