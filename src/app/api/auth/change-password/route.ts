import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { translateAuthError } from "@/lib/auth-errors";
import { MUST_CHANGE_PASSWORD_FLAG, mustChangePassword, validateNewPassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Phiên tạo từ link khôi phục qua email (amr "otp"/"recovery") chỉ được bỏ qua mật khẩu cũ trong khoảng này. */
const RECOVERY_WINDOW_SECONDS = 60 * 60;

async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  if (error) return false;
  await verifier.auth.signOut({ scope: "local" });
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    if (!claims?.sub) {
      return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | { currentPassword?: unknown; newPassword?: unknown }
      | null;
    const newPassword = body?.newPassword;
    const invalid = validateNewPassword(newPassword);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const amr = Array.isArray(claims.amr) ? (claims.amr as { method?: string; timestamp?: number }[]) : [];
    const recentSince = Date.now() / 1000 - RECOVERY_WINDOW_SECONDS;
    const isRecovery = amr.some(
      (m) => (m?.method === "recovery" || m?.method === "otp") && (m.timestamp ?? 0) >= recentSince,
    );
    const skipCurrent = isRecovery || mustChangePassword(claims.app_metadata);

    if (!skipCurrent) {
      const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
      const email = typeof claims.email === "string" ? claims.email : "";
      if (!current) return NextResponse.json({ error: "Vui lòng nhập mật khẩu hiện tại." }, { status: 400 });
      if (!email || !(await verifyCurrentPassword(email, current))) {
        return NextResponse.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword as string });
    if (error) {
      const message =
        error.code === "same_password" ? "Mật khẩu mới phải khác mật khẩu cũ." : translateAuthError(error);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (mustChangePassword(claims.app_metadata)) {
      const { error: flagErr } = await createServiceClient().auth.admin.updateUserById(claims.sub, {
        app_metadata: { [MUST_CHANGE_PASSWORD_FLAG]: null },
      });
      if (flagErr) throw flagErr;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/auth/change-password] POST error:", err);
    return NextResponse.json({ error: "Đã xảy ra lỗi. Vui lòng thử lại sau." }, { status: 500 });
  }
}
