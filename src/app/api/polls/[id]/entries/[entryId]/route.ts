import { NextRequest, NextResponse } from "next/server";
import { getPollById } from "@/lib/data/polls";
import { PUBLIC_ENTRY_CACHE_CONTROL, toEntryDetail } from "@/lib/polls/entry-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chi tiết một bài thi đã duyệt (mô tả, tác giả, đường dẫn ảnh), đọc từ cache chung của chương trình. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id, entryId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(entryId)) {
    return NextResponse.json({ error: "Mã bài thi không hợp lệ." }, { status: 400 });
  }
  const poll = await getPollById(id);
  const option = poll?.options.find((o) => o.id === entryId);
  if (!option) {
    return NextResponse.json({ error: "Không tìm thấy bài thi." }, { status: 404 });
  }
  return NextResponse.json(
    { entry: toEntryDetail(option) },
    { headers: { "Cache-Control": PUBLIC_ENTRY_CACHE_CONTROL } },
  );
}
