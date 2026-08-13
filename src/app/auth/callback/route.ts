import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("approval_status, role")
          .eq("id", user.id)
          .maybeSingle();

        const status = profile?.approval_status ?? "pending";

        if (status !== "approved") {
          const pendingPath =
            status === "rejected" ? "/pending?status=rejected" : "/pending";
          return NextResponse.redirect(`${origin}${pendingPath}`);
        }

        if (profile?.role === "admin") {
          return NextResponse.redirect(`${origin}/admin/users`);
        }
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
