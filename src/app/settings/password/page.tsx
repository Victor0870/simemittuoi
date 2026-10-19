import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChangePasswordPanel } from "@/components/account/ChangePasswordPanel";
import { CHANGE_PASSWORD_PATH, mustChangePassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Đổi mật khẩu | CDILV.VN",
};

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect(`/login?next=${CHANGE_PASSWORD_PATH}`);

  return <ChangePasswordPanel required={mustChangePassword(claims.app_metadata)} />;
}
