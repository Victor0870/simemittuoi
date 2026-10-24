import { cache } from "react";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CDILV_RPC } from "@/lib/supabase/tables";
import {
  EMPTY_ACCESS,
  hasPermission,
  parseAccess,
  type AccessInfo,
  type PermissionCode,
} from "@/lib/auth/permissions";

export type CurrentAccess = AccessInfo & { userId: string };

/** Quyền của người đang đăng nhập (null nếu chưa đăng nhập). Gọi nhiều lần trong 1 request chỉ truy vấn 1 lần. */
export const getCurrentAccess = cache(async (): Promise<CurrentAccess | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(CDILV_RPC.myPermissions);
  if (error) {
    console.error("[auth] cdilv_my_permissions error:", error.message);
    return { userId, ...EMPTY_ACCESS };
  }
  return { userId, ...parseAccess(data) };
});

type GuardResult =
  | { access: CurrentAccess; response?: undefined }
  | { access?: undefined; response: NextResponse };

function deny(status: 401 | 403, message: string): GuardResult {
  return { response: NextResponse.json({ error: message }, { status }) };
}

export async function requirePermission(code: PermissionCode): Promise<GuardResult> {
  const access = await getCurrentAccess();
  if (!access) return deny(401, "Vui lòng đăng nhập tài khoản.");
  if (!hasPermission(access, code)) {
    return deny(403, "Bạn chưa được phân quyền thực hiện thao tác này.");
  }
  return { access };
}

export async function requireAdmin(): Promise<GuardResult> {
  const access = await getCurrentAccess();
  if (!access) return deny(401, "Vui lòng đăng nhập tài khoản.");
  if (!access.isAdmin) return deny(403, "Chỉ Quản trị viên mới thực hiện được thao tác này.");
  return { access };
}
