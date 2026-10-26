import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MemberProfileForm } from "@/components/members/MemberProfileForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadMemberProfile } from "@/lib/members/profile-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OfficeMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/admin/members/${id}`);
  if (!hasPermission(access, PERMISSIONS.membersView)) redirect("/");

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await loadMemberProfile(createServiceClient(), id);
  if (!profile) notFound();

  const canEdit = hasPermission(access, PERMISSIONS.membersEdit);
  const isSelf = id === access.userId;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Hồ sơ đoàn viên</h1>
          <p className="text-sm text-on-surface-variant">
            {canEdit
              ? "Bạn có thể cập nhật hồ sơ thay cho đoàn viên. Mọi thay đổi đều được ghi lịch sử."
              : "Chế độ chỉ xem."}
          </p>
        </div>
        <Link
          className="flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
          href="/admin/members"
        >
          <MaterialIcon className="text-[18px]" name="arrow_back" />
          Danh sách hồ sơ
        </Link>
      </div>
      <MemberProfileForm
        initial={profile}
        readOnly={!canEdit && !isSelf}
        targetUserId={isSelf ? undefined : id}
      />
    </div>
  );
}
