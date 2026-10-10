import { NextRequest, NextResponse } from "next/server";
import { getPollById } from "@/lib/data/polls";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const poll = await getPollById(id);
    if (!poll) {
      return NextResponse.json({ error: "Không tìm thấy chương trình bình chọn." }, { status: 404 });
    }
    return NextResponse.json(poll);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Lỗi tải dữ liệu" }, { status: 500 });
  }
}
