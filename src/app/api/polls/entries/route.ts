import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import {
  MAX_ACTIVE_SUBMISSIONS,
  getSubmitter,
  loadEntries,
  submissionWindowError,
  validateEntryInput,
} from "@/lib/polls/entries-server";
import { PRIVATE_NO_STORE } from "@/lib/polls/entry-view";

export const dynamic = "force-dynamic";

const ENTRY_COLUMNS =
  "id, poll_id, title, description, image_urls, approval_status, review_note, submitted_at, reviewed_at, submitted_by";

async function loadPoll(db: ReturnType<typeof createServiceClient>, pollId: string) {
  const { data, error } = await db.from(CDILV_TABLE.polls).select("*").eq("id", pollId).maybeSingle();
  if (error) throw error;
  return data;
}

async function loadOwnEntry(db: ReturnType<typeof createServiceClient>, optionId: string, userId: string) {
  const { data, error } = await db
    .from(CDILV_TABLE.pollOptions)
    .select(ENTRY_COLUMNS)
    .eq("id", optionId)
    .eq("submitted_by", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Bài người đang đăng nhập đã nộp trong chương trình. */
export async function GET(request: NextRequest) {
  try {
    const pollId = request.nextUrl.searchParams.get("pollId")?.trim();
    if (!pollId) return NextResponse.json({ error: "Thiếu ID chương trình." }, { status: 400 });

    const auth = await getSubmitter();
    if ("error" in auth) return NextResponse.json({ error: auth.error, entries: [] }, { status: auth.status });

    const db = createServiceClient();
    const { data, error } = await db
      .from(CDILV_TABLE.pollOptions)
      .select(ENTRY_COLUMNS)
      .eq("poll_id", pollId)
      .eq("submitted_by", auth.submitter.userId)
      .order("submitted_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json(
      { entries: await loadEntries(db, data ?? []), submitter: auth.submitter },
      { headers: { "Cache-Control": PRIVATE_NO_STORE } },
    );
  } catch (err: any) {
    console.error("[api/polls/entries] GET error:", err);
    return NextResponse.json({ error: err?.message || "Không tải được bài dự thi." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const pollId = String(body?.pollId ?? "").trim();
    if (!pollId) return NextResponse.json({ error: "Thiếu ID chương trình." }, { status: 400 });

    const auth = await getSubmitter();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const db = createServiceClient();
    const poll = await loadPoll(db, pollId);
    if (!poll) return NextResponse.json({ error: "Không tìm thấy chương trình." }, { status: 404 });
    const windowError = submissionWindowError(poll);
    if (windowError) return NextResponse.json({ error: windowError }, { status: 400 });

    const { count, error: countError } = await db
      .from(CDILV_TABLE.pollOptions)
      .select("id", { count: "exact", head: true })
      .eq("poll_id", pollId)
      .eq("submitted_by", auth.submitter.userId)
      .in("approval_status", ["pending", "approved"]);
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_ACTIVE_SUBMISSIONS) {
      return NextResponse.json(
        { error: `Mỗi người nộp tối đa ${MAX_ACTIVE_SUBMISSIONS} bài đang chờ duyệt hoặc đã duyệt.` },
        { status: 400 },
      );
    }

    const input = await validateEntryInput(db, body);
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

    const { data: last } = await db
      .from(CDILV_TABLE.pollOptions)
      .select("order_num")
      .eq("poll_id", pollId)
      .order("order_num", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: created, error: insertError } = await db
      .from(CDILV_TABLE.pollOptions)
      .insert({
        poll_id: pollId,
        order_num: (Number(last?.order_num) || 0) + 1,
        title: input.value.title,
        description: input.value.description,
        image_urls: input.value.imageUrls,
        is_active: true,
        approval_status: "pending",
        submitted_by: auth.submitter.userId,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertError || !created) throw insertError || new Error("Không lưu được bài dự thi.");

    const { error: membersError } = await db
      .from(CDILV_TABLE.pollOptionMembers)
      .insert(input.value.members.map((m) => ({ option_id: created.id, ...m })));
    if (membersError) {
      await db.from(CDILV_TABLE.pollOptions).delete().eq("id", created.id).eq("approval_status", "pending");
      throw membersError;
    }

    return NextResponse.json({ success: true, message: "Đã nộp bài. Bài đang chờ Ban tổ chức duyệt." });
  } catch (err: any) {
    console.error("[api/polls/entries] POST error:", err);
    return NextResponse.json({ error: err?.message || "Không nộp được bài." }, { status: 500 });
  }
}

/** Sửa bài khi còn chờ duyệt và còn hạn nộp. */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const optionId = String(body?.optionId ?? "").trim();
    if (!optionId) return NextResponse.json({ error: "Thiếu bài dự thi." }, { status: 400 });

    const auth = await getSubmitter();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const db = createServiceClient();
    const entry = await loadOwnEntry(db, optionId, auth.submitter.userId);
    if (!entry) return NextResponse.json({ error: "Không tìm thấy bài của bạn." }, { status: 404 });
    if (entry.approval_status !== "pending") {
      return NextResponse.json({ error: "Chỉ sửa được bài đang chờ duyệt." }, { status: 400 });
    }
    const poll = await loadPoll(db, entry.poll_id);
    const windowError = poll ? submissionWindowError(poll) : "Không tìm thấy chương trình.";
    if (windowError) return NextResponse.json({ error: windowError }, { status: 400 });

    const input = await validateEntryInput(db, body);
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

    const { data: updated, error: updateError } = await db
      .from(CDILV_TABLE.pollOptions)
      .update({
        title: input.value.title,
        description: input.value.description,
        image_urls: input.value.imageUrls,
      })
      .eq("id", optionId)
      .eq("submitted_by", auth.submitter.userId)
      .eq("approval_status", "pending")
      .select("id");
    if (updateError) throw updateError;
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Bài vừa được duyệt hoặc đã đổi trạng thái." }, { status: 409 });
    }

    const { error: deleteError } = await db.from(CDILV_TABLE.pollOptionMembers).delete().eq("option_id", optionId);
    if (deleteError) throw deleteError;
    const { error: membersError } = await db
      .from(CDILV_TABLE.pollOptionMembers)
      .insert(input.value.members.map((m) => ({ option_id: optionId, ...m })));
    if (membersError) throw membersError;

    return NextResponse.json({ success: true, message: "Đã cập nhật bài dự thi." });
  } catch (err: any) {
    console.error("[api/polls/entries] PATCH error:", err);
    return NextResponse.json({ error: err?.message || "Không cập nhật được bài." }, { status: 500 });
  }
}

/** Rút bài khi còn chờ duyệt (giữ lại dữ liệu, chỉ đổi trạng thái). */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const optionId = String(body?.optionId ?? "").trim();
    if (!optionId) return NextResponse.json({ error: "Thiếu bài dự thi." }, { status: 400 });

    const auth = await getSubmitter();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const db = createServiceClient();
    const { data: updated, error } = await db
      .from(CDILV_TABLE.pollOptions)
      .update({ approval_status: "withdrawn" })
      .eq("id", optionId)
      .eq("submitted_by", auth.submitter.userId)
      .eq("approval_status", "pending")
      .select("id");
    if (error) throw error;
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Chỉ rút được bài của bạn đang chờ duyệt." }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Đã rút bài dự thi." });
  } catch (err: any) {
    console.error("[api/polls/entries] DELETE error:", err);
    return NextResponse.json({ error: err?.message || "Không rút được bài." }, { status: 500 });
  }
}
