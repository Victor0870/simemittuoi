import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/pending",
  "/auth/callback",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  if (!url || !anonKey) {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (pathname.startsWith("/admin")) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/login";
        redirectUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(redirectUrl);
      }
      return supabaseResponse;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    const status = profile?.approval_status ?? "pending";
    const role = profile?.role ?? "user";

    if (pathname.startsWith("/admin")) {
      if (role !== "admin" || status !== "approved") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = status === "approved" ? "/" : "/pending";
        return NextResponse.redirect(redirectUrl);
      }
      return supabaseResponse;
    }

    if (status === "approved") {
      if (pathname === "/pending" || pathname === "/login" || pathname === "/register") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/";
        return NextResponse.redirect(redirectUrl);
      }
      return supabaseResponse;
    }

    // pending / rejected: chỉ cho phép vài trang công khai + pending
    if (!isPublicPath(pathname) || pathname === "/") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/pending";
      if (status === "rejected") {
        redirectUrl.searchParams.set("status", "rejected");
      }
      return NextResponse.redirect(redirectUrl);
    }

    return supabaseResponse;
  } catch {
    return NextResponse.next({ request });
  }
}
