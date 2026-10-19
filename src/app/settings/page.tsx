import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountInfo } from "@/components/account/AccountInfo";
import { getCurrentAccess } from "@/lib/auth/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const metadata: Metadata = {
  title: "Thông tin tài khoản | CDILV.VN",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/settings");

  const db = createServiceClient();
  const [{ data: profile }, { data: bonus }, { data: board }] = await Promise.all([
    db
      .from(CDILV_TABLE.profiles)
      .select("full_name, employee_code, department, avatar_url, total_score, rank")
      .eq("id", access.userId)
      .maybeSingle(),
    db
      .from(CDILV_TABLE.scoreEvents)
      .select("id")
      .eq("user_id", access.userId)
      .eq("award_label", "avatar_bonus")
      .maybeSingle(),
    db.from(CDILV_TABLE.leaderboard).select("total_score, rank").eq("id", access.userId).maybeSingle(),
  ]);

  const score = Number(board?.total_score ?? profile?.total_score ?? 0) || 0;
  const rank = Number(board?.rank ?? profile?.rank ?? 0) || 0;
  const levels = [
    ...(access.isAdmin ? ["Quản trị viên"] : []),
    ...access.roles.map((r) => r.name),
  ];

  return (
    <AccountInfo
      avatarUrl={profile?.avatar_url ?? null}
      department={profile?.department ?? null}
      employeeCode={profile?.employee_code ?? null}
      fullName={profile?.full_name ?? ""}
      hasAvatarBonus={Boolean(bonus?.id)}
      isApproved={access.isApproved}
      levels={levels.length ? levels : [access.isApproved ? "Đoàn viên" : "Chờ phê duyệt"]}
      rank={rank}
      score={score}
      userId={access.userId}
    />
  );
}
