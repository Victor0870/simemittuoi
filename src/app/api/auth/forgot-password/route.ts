import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";

const MAX_PER_IP_PER_HOUR = 10;
const MAX_PER_USER_PER_HOUR = 3;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_MESSAGE =
  "Đã ghi nhận yêu cầu. Nếu email đúng với tài khoản đã đăng ký, bạn sẽ nhận email đặt lại mật khẩu (kiểm tra cả mục Thư rác/Spam). Nếu không nhận được, Ban chấp hành Công đoàn sẽ liên hệ hỗ trợ bạn.";

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown; contact?: unknown } | null;
    const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Email không hợp lệ. Vui lòng kiểm tra lại." }, { status: 400 });
    }
    const contact = typeof body?.contact === "string" ? body.contact.trim().slice(0, 100) || null : null;

    const service = createServiceClient();
    const ip = clientIp(request);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    if (ip) {
      const { count } = await service
        .from(CDILV_TABLE.passwordResetRequests)
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", hourAgo);
      if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
        return NextResponse.json({ error: "Bạn thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại." }, { status: 429 });
      }
    }

    const { data: userId, error: findErr } = await service.rpc(CDILV_RPC.findUserByEmail, { p_email: email });
    if (findErr) throw findErr;
    if (!userId) return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });

    const { count: recent } = await service
      .from(CDILV_TABLE.passwordResetRequests)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", hourAgo);
    if ((recent ?? 0) >= MAX_PER_USER_PER_HOUR) {
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
    }

    const supabase = await createClient();
    const { error: mailErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${request.nextUrl.origin}/auth/callback?next=/reset-password`,
    });
    if (mailErr) console.warn("[api/auth/forgot-password] email not sent:", mailErr.message);

    const { data: pending } = await service
      .from(CDILV_TABLE.passwordResetRequests)
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    const { error: insertErr } = await service.from(CDILV_TABLE.passwordResetRequests).insert({
      user_id: userId,
      email,
      contact,
      email_sent: !mailErr,
      ip,
    });
    if (insertErr) throw insertErr;

    if (!pending) {
      const [{ data: profile }, { data: admins }] = await Promise.all([
        service.from(CDILV_TABLE.profiles).select("full_name, employee_code").eq("id", userId).maybeSingle(),
        service.from(CDILV_TABLE.profiles).select("id").eq("role", "admin").eq("approval_status", "approved"),
      ]);
      const who = [profile?.full_name || email, profile?.employee_code].filter(Boolean).join(" · ");
      if (admins?.length) {
        await service.from(CDILV_TABLE.notifications).insert(
          admins.map((a) => ({
            user_id: a.id,
            type: "password_reset_request",
            title: `${who} cần hỗ trợ đặt lại mật khẩu`,
            message: contact ? `Liên hệ: ${contact}` : "Đoàn viên đã gửi yêu cầu quên mật khẩu.",
            link: "/admin/users#password-resets",
            actor_id: userId,
          })),
        );
      }
    }

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (err) {
    console.error("[api/auth/forgot-password] POST error:", err);
    return NextResponse.json({ error: "Đã xảy ra lỗi. Vui lòng thử lại sau." }, { status: 500 });
  }
}
