import { NextRequest, NextResponse } from "next/server";
import { getPollById } from "@/lib/data/polls";
import { PUBLIC_ENTRY_CACHE_CONTROL, toEntryListItem } from "@/lib/polls/entry-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Danh sách bài thi rút gọn (không ảnh, không mô tả), dùng chung cho mọi người nên cho CDN cache. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Mã chương trình không hợp lệ." }, { status: 400 });
  }
  const poll = await getPollById(id);
  if (!poll) {
    return NextResponse.json({ error: "Không tìm thấy chương trình bình chọn." }, { status: 404 });
  }
  return NextResponse.json(
    { pollId: poll.id, entries: poll.options.map(toEntryListItem) },
    { headers: { "Cache-Control": PUBLIC_ENTRY_CACHE_CONTROL } },
  );
}
