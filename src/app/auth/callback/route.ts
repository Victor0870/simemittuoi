import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const isRecovery = searchParams.get("next") === "/reset-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && isRecovery) {
      return NextResponse.redirect(`${origin}/reset-password`);
    }

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from(CDILV_TABLE.profiles)
          .select("approval_status, role")
          .eq("id", user.id)
          .maybeSingle();

        const status = profile?.approval_status ?? "pending";

        if (status !== "approved") {
          const pendingPath =
            status === "rejected" ? "/pending?status=rejected" : "/pending";
          return NextResponse.redirect(`${origin}${pendingPath}`);
        }
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  if (isRecovery) {
    return NextResponse.redirect(`${origin}/reset-password?error=link`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
