import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

    // Đã duyệt
    if (pathname.startsWith("/admin") && role !== "admin") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }

    if (
      pathname === "/pending" ||
      pathname === "/login" ||
      pathname === "/register"
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = role === "admin" ? "/admin/users" : "/";
      return NextResponse.redirect(redirectUrl);
    }

    return supabaseResponse;
  } catch {
    return NextResponse.next({ request });
  }
}
