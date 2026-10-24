import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { getPollById, getPollByIdUncached } from "@/lib/data/polls";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Người quản lý bình chọn (form sửa chương trình) luôn đọc dữ liệu mới nhất, không qua cache 15 phút
    const access = await getCurrentAccess();
    const canManage = Boolean(access && hasPermission(access, PERMISSIONS.pollsManage));
    const poll = canManage ? await getPollByIdUncached(id) : await getPollById(id);
    if (!poll) {
      return NextResponse.json({ error: "Không tìm thấy chương trình bình chọn." }, { status: 404 });
    }
    return NextResponse.json(poll);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Lỗi tải dữ liệu" }, { status: 500 });
  }
}
