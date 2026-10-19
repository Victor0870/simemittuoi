import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { MUST_CHANGE_PASSWORD_FLAG } from "@/lib/auth/password";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function generateTempPassword(): string {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${part()}-${part()}`;
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard.response) return guard.response;

    const body = (await request.json().catch(() => null)) as
      | { action?: unknown; userId?: unknown; requestId?: unknown }
      | null;
    const service = createServiceClient();
    const now = new Date().toISOString();

    if (body?.action === "dismiss") {
      const requestId = typeof body.requestId === "string" ? body.requestId : "";
      if (!requestId) return NextResponse.json({ error: "Thiếu mã yêu cầu." }, { status: 400 });
      const { data: req } = await service
        .from(CDILV_TABLE.passwordResetRequests)
        .select("user_id")
        .eq("id", requestId)
        .maybeSingle();
      if (!req) return NextResponse.json({ error: "Không tìm thấy yêu cầu." }, { status: 404 });
      const { error } = await service
        .from(CDILV_TABLE.passwordResetRequests)
        .update({ status: "dismissed", handled_by: guard.access.userId, handled_at: now })
        .eq("user_id", req.user_id)
        .eq("status", "pending");
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body?.action === "reset") {
      const userId = typeof body.userId === "string" ? body.userId : "";
      if (!userId) return NextResponse.json({ error: "Thiếu tài khoản cần đặt lại." }, { status: 400 });
      if (userId === guard.access.userId) {
        return NextResponse.json(
          { error: "Không tự cấp mật khẩu tạm cho chính mình. Hãy dùng mục Đổi mật khẩu trong trang Tài khoản." },
          { status: 400 },
        );
      }

      const { data: profile } = await service
        .from(CDILV_TABLE.profiles)
        .select("id, full_name")
        .eq("id", userId)
        .maybeSingle();
      if (!profile) return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });

      const tempPassword = generateTempPassword();
      const { error: updateErr } = await service.auth.admin.updateUserById(userId, {
        password: tempPassword,
        app_metadata: { [MUST_CHANGE_PASSWORD_FLAG]: true },
      });
      if (updateErr) throw updateErr;

      await service
        .from(CDILV_TABLE.passwordResetRequests)
        .update({ status: "done", handled_by: guard.access.userId, handled_at: now })
        .eq("user_id", userId)
        .eq("status", "pending");

      return NextResponse.json({ ok: true, tempPassword, fullName: profile.full_name });
    }

    return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  } catch (err) {
    console.error("[api/admin/password-reset] POST error:", err);
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message;
    return NextResponse.json({ error: message || "Đã xảy ra lỗi." }, { status: 500 });
  }
}
