import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";
import {
  findAdminRoutePermissions,
  hasPermission,
  parseAccess,
  type PermissionCode,
} from "@/lib/auth/permissions";
import { CHANGE_PASSWORD_PATH, mustChangePassword } from "@/lib/auth/password";
import { FORWARDED_ACCESS_HEADER, signForwardedAccess } from "@/lib/auth/forwarded-access";

type SupabaseMiddlewareClient = ReturnType<typeof createServerClient>;

function isMemberOnlyPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname === "/profile" ||
    pathname === "/life-events" ||
    pathname.startsWith("/life-events/") ||
    pathname === "/albums" ||
    pathname.startsWith("/albums/")
  );
}

function isAuthExemptPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/pending" ||
    pathname.startsWith("/auth/")
  );
}

type GateInfo = {
  status: string;
  isAdminRole: boolean;
  /** Quyền mở trang /admin tương ứng (chỉ có ý nghĩa khi đã duyệt và không phải admin). */
  adminPermissionAllowed: boolean;
  /** Kết quả thô của cdilv_my_permissions để chuyển xuống trang (null nếu không lấy được). */
  rawAccess: unknown;
};

/**
 * Trạng thái duyệt / vai trò / quyền trang admin của người đang đăng nhập.
 * Thường chỉ 1 lần gọi (cdilv_my_permissions — cùng RPC mà getCurrentAccess dùng ở trang);
 * chỉ người chưa được duyệt mới cần đọc thêm approval_status để phân biệt "bị từ chối".
 */
async function loadGateInfo(
  supabase: SupabaseMiddlewareClient,
  userId: string,
  adminPermissions: PermissionCode[] | null,
  needsRejectedFlag: boolean,
): Promise<GateInfo> {
  const { data: rawAccess, error } = await supabase.rpc(CDILV_RPC.myPermissions);

  if (!error) {
    const access = parseAccess(rawAccess);
    if (access.isApproved) {
      return {
        status: "approved",
        isAdminRole: access.isAdmin,
        adminPermissionAllowed: adminPermissions
          ? adminPermissions.some((code) => hasPermission(access, code))
          : false,
        rawAccess,
      };
    }

    // Chưa duyệt đang ở login/register/pending: không chuyển hướng nên không cần biết có bị từ chối không
    if (!needsRejectedFlag) {
      return { status: "pending", isAdminRole: false, adminPermissionAllowed: false, rawAccess: null };
    }

    const { data: profile } = await supabase
      .from(CDILV_TABLE.profiles)
      .select("approval_status")
      .eq("id", userId)
      .maybeSingle();
    return {
      status: profile?.approval_status ?? "pending",
      isAdminRole: false,
      adminPermissionAllowed: false,
      rawAccess: null,
    };
  }

  // RPC lỗi: kiểm tra như cũ bằng hồ sơ + cdilv_has_permission
  const [{ data: profile }, permissionResults] = await Promise.all([
    supabase
      .from(CDILV_TABLE.profiles)
      .select("role, approval_status")
      .eq("id", userId)
      .maybeSingle(),
    Promise.all(
      (adminPermissions ?? []).map((code) => supabase.rpc(CDILV_RPC.hasPermission, { p_code: code })),
    ),
  ]);
  return {
    status: profile?.approval_status ?? "pending",
    isAdminRole: (profile?.role ?? "user") === "admin",
    adminPermissionAllowed: permissionResults.some((result) => result.data === true),
    rawAccess: null,
  };
}

/** Giữ cookie phiên vừa làm mới, thêm header quyền đã ký cho trang phía sau. */
async function withForwardedAccess(
  request: NextRequest,
  response: NextResponse,
  userId: string,
  rawAccess: unknown,
): Promise<NextResponse> {
  const signed = await signForwardedAccess(userId, rawAccess);
  if (!signed) return response;

  const headers = new Headers(request.headers);
  headers.set(FORWARDED_ACCESS_HEADER, signed);
  const forwarded = NextResponse.next({ request: { headers } });
  response.cookies.getAll().forEach((cookie) => forwarded.cookies.set(cookie));
  return forwarded;
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  // Header quyền nội bộ chỉ do middleware tạo; bỏ bản trình duyệt tự gửi (dù đã có chữ ký HMAC)
  try {
    request.headers.delete(FORWARDED_ACCESS_HEADER);
  } catch {
    /* headers không cho sửa: chữ ký HMAC vẫn chặn giả mạo */
  }

  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  // Tối ưu 1: Nếu không có cookie auth của Supabase, không cần gọi API (khách lướt web)
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.includes("auth-token") || c.name.startsWith("sb-"));

  if (!hasAuthCookie) {
    if (isMemberOnlyPath(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    // getClaims() xác thực JWT cục bộ (signing key bất đối xứng), chỉ gọi Auth server khi cần
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ?? null;

    if (!userId) {
      if (isMemberOnlyPath(pathname)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/login";
        redirectUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(redirectUrl);
      }
      return supabaseResponse;
    }

    if (
      mustChangePassword(claimsData?.claims?.app_metadata) &&
      pathname !== CHANGE_PASSWORD_PATH &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/auth/")
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = CHANGE_PASSWORD_PATH;
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    // Tối ưu 2: Chỉ truy vấn quyền khi cần kiểm tra trang được bảo vệ hoặc trang đặc biệt
    const requiresProfileCheck =
      pathname === "/" ||
      isMemberOnlyPath(pathname) ||
      pathname === "/pending" ||
      pathname === "/login" ||
      pathname === "/register";

    // Prefetch của router cũng phải qua đủ cổng duyệt/quyền: header prefetch do client tự đặt được
    if (!requiresProfileCheck) {
      return supabaseResponse;
    }

    const adminPermissions = pathname.startsWith("/admin") ? findAdminRoutePermissions(pathname) : null;
    const gate = await loadGateInfo(
      supabase,
      userId,
      adminPermissions,
      !isAuthExemptPath(pathname),
    );
    const status = gate.status;

    // Chưa duyệt / bị từ chối: chỉ được ở login/register/pending/auth
    if (status !== "approved") {
      if (!isAuthExemptPath(pathname)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/pending";
        redirectUrl.search = "";
        if (status === "rejected") {
          redirectUrl.searchParams.set("status", "rejected");
        }
        return NextResponse.redirect(redirectUrl);
      }
      return supabaseResponse;
    }

    // Đã duyệt: trang /admin chỉ cho admin, trừ các trang được mở theo quyền
    if (pathname.startsWith("/admin") && !gate.isAdminRole) {
      if (!gate.adminPermissionAllowed) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/";
        return NextResponse.redirect(redirectUrl);
      }
    }

    if (
      pathname === "/pending" ||
      pathname === "/login" ||
      pathname === "/register"
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }

    if (gate.rawAccess !== null) {
      return await withForwardedAccess(request, supabaseResponse, userId, gate.rawAccess);
    }
    return supabaseResponse;
  } catch (e) {
    console.error("[middleware] updateSession error:", e);
    return supabaseResponse;
  }
}
