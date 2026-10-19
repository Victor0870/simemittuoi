import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { ATTACHMENT_MIME_TYPES, LIFE_EVENT_LIMITS } from "@/lib/life-events/registry";
import { canHandleLifeEvents, loadLifeEventRow } from "@/lib/life-events/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC, CDILV_STORAGE, CDILV_TABLE } from "@/lib/supabase/tables";

type Params = { params: Promise<{ id: string }> };

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

async function loadContext(id: string) {
  const access = await getCurrentAccess();
  if (!access?.isApproved) return { error: NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  const db = createServiceClient();
  const event = await loadLifeEventRow(db, id);
  const isOwner = event?.member_id === access.userId;
  const canHandle = canHandleLifeEvents(access);
  if (!event || (!isOwner && !canHandle)) {
    return { error: NextResponse.json({ error: "Không tìm thấy tin báo." }, { status: 404 }) };
  }
  if (event.status === "withdrawn") {
    return { error: NextResponse.json({ error: "Tin báo đã rút lại, không bổ sung được." }, { status: 409 }) };
  }
  return { access, db, event, isOwner, canHandle };
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await loadContext(id);
    if ("error" in ctx) return ctx.error;
    const { access, db, event } = ctx;

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Chưa chọn tệp." }, { status: 400 });
    }
    if (!(ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: "Chỉ nhận ảnh (JPG, PNG, WEBP) hoặc PDF." }, { status: 400 });
    }
    if (file.size > LIFE_EVENT_LIMITS.maxFileBytes) {
      return NextResponse.json({ error: "Tệp tối đa 4 MB." }, { status: 400 });
    }

    const { count } = await db
      .from(CDILV_TABLE.lifeEventAttachments)
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    if ((count ?? 0) >= LIFE_EVENT_LIMITS.maxAttachments) {
      return NextResponse.json(
        { error: `Mỗi tin báo tối đa ${LIFE_EVENT_LIMITS.maxAttachments} tệp đính kèm.` },
        { status: 400 },
      );
    }

    const storagePath = `${event.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${EXT_BY_MIME[file.type]}`;
    const { error: uploadErr } = await db.storage
      .from(CDILV_STORAGE.lifeEvents)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadErr) throw uploadErr;

    const fileName = (file.name || `giay-to.${EXT_BY_MIME[file.type]}`).slice(0, 200);
    const { data: row, error: insertErr } = await db
      .from(CDILV_TABLE.lifeEventAttachments)
      .insert({
        event_id: event.id,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: access.userId,
      })
      .select("id")
      .single();
    if (insertErr) {
      await db.storage.from(CDILV_STORAGE.lifeEvents).remove([storagePath]);
      throw insertErr;
    }

    await db.rpc(CDILV_RPC.lifeEventLog, {
      p_event_id: event.id,
      p_actor_id: access.userId,
      p_action: "attachment_added",
      p_note: fileName,
    });

    return NextResponse.json({ success: true, id: row.id });
  } catch (err: unknown) {
    console.error("[api/life-events/attachments] POST error:", err);
    return NextResponse.json({ error: "Không tải được tệp lên." }, { status: 500 });
  }
}

/** ?attachmentId=… – người tải lên xóa được khi tin còn chờ tiếp nhận; người tiếp nhận xóa được mọi lúc. */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await loadContext(id);
    if ("error" in ctx) return ctx.error;
    const { access, db, event, canHandle } = ctx;

    const attachmentId = new URL(request.url).searchParams.get("attachmentId");
    const { data: att } = await db
      .from(CDILV_TABLE.lifeEventAttachments)
      .select("id, storage_path, file_name, uploaded_by")
      .eq("id", attachmentId ?? "")
      .eq("event_id", event.id)
      .maybeSingle();
    if (!att) return NextResponse.json({ error: "Không tìm thấy tệp." }, { status: 404 });

    const ownUpload = att.uploaded_by === access.userId && event.status === "submitted";
    if (!ownUpload && !canHandle) {
      return NextResponse.json({ error: "Tin đã được tiếp nhận, không xóa được tệp." }, { status: 403 });
    }

    const { error } = await db.from(CDILV_TABLE.lifeEventAttachments).delete().eq("id", att.id);
    if (error) throw error;
    await db.storage.from(CDILV_STORAGE.lifeEvents).remove([att.storage_path]);
    await db.rpc(CDILV_RPC.lifeEventLog, {
      p_event_id: event.id,
      p_actor_id: access.userId,
      p_action: "attachment_removed",
      p_note: att.file_name,
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/life-events/attachments] DELETE error:", err);
    return NextResponse.json({ error: "Không xóa được tệp." }, { status: 500 });
  }
}
