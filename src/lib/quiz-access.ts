import { NextResponse } from "next/server";
import { getAlbumMemberContext } from "@/lib/album-access";

export async function requireQuizMember() {
  const ctx = await getAlbumMemberContext();
  if (!ctx.user) {
    return { response: NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  }
  if (!ctx.isApproved) {
    return {
      response: NextResponse.json(
        { error: "Tài khoản cần được phê duyệt để tham gia thi trắc nghiệm." },
        { status: 403 },
      ),
    };
  }
  return { ctx, userId: ctx.user.id };
}

export async function requireQuizAdmin() {
  const ctx = await getAlbumMemberContext();
  if (!ctx.user) {
    return { response: NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  }
  if (!ctx.isAdmin) {
    return {
      response: NextResponse.json(
        { error: "Chỉ Quản trị viên mới được quản lý thi trắc nghiệm." },
        { status: 403 },
      ),
    };
  }
  return { ctx, userId: ctx.user.id };
}
