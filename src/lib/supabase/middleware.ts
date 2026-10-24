import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";
import { findAdminRoutePermission } from "@/lib/auth/permissions";
import { CHANGE_PASSWORD_PATH, mustChangePassword } from "@/lib/auth/password";

function isMemberOnlyPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname === "/office" ||
    pathname.startsWith("/office/") ||
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

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

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

    // Tối ưu 2: Chỉ truy vấn database profiles khi cần kiểm tra quyền Admin hoặc trang đặc biệt
    const requiresProfileCheck =
      isMemberOnlyPath(pathname) ||
      pathname === "/pending" ||
      pathname === "/login" ||
      pathname === "/register";

    if (!requiresProfileCheck) {
      return supabaseResponse;
    }

    // Trang /admin mở theo quyền: kiểm tra quyền song song với hồ sơ, kết quả chỉ dùng khi đã duyệt và không phải admin
    const adminPermission = pathname.startsWith("/admin") ? findAdminRoutePermission(pathname) : null;
    const [{ data: profile }, permissionResult] = await Promise.all([
      supabase
        .from(CDILV_TABLE.profiles)
        .select("role, approval_status")
        .eq("id", userId)
        .maybeSingle(),
      adminPermission ? supabase.rpc(CDILV_RPC.hasPermission, { p_code: adminPermission }) : null,
    ]);

    const status = profile?.approval_status ?? "pending";
    const role = profile?.role ?? "user";

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
    if (pathname.startsWith("/admin") && role !== "admin") {
      const allowed = permissionResult?.data === true;
      if (!allowed) {
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

    return supabaseResponse;
  } catch (e) {
    console.error("[middleware] updateSession error:", e);
    return supabaseResponse;
  }
}
