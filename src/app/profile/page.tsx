import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MemberProfileForm } from "@/components/members/MemberProfileForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { loadMemberProfile } from "@/lib/members/profile-server";
import { PROFILE_ITEM_COUNT, PROFILE_POINTS_PER_ITEM } from "@/lib/members/profile-shared";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Thông tin cá nhân | CDILV.VN",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyProfilePage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/profile");
  if (!access.isApproved) redirect("/pending");

  const profile = await loadMemberProfile(createServiceClient(), access.userId);
  if (!profile) redirect("/");

  return (
    <div className="max-w-3xl space-y-4 pb-6 sm:space-y-5 sm:pb-10">
      <div>
        <h1 className="text-xl font-extrabold text-[#173A67] sm:text-headline-md">Thông tin cá nhân</h1>
        <p className="text-xs text-on-surface-variant sm:text-sm">
          Hồ sơ đoàn viên phục vụ giấy tờ hành chính công đoàn. Chỉ bạn và người được phân quyền xem được.
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#1B7F5C]">
          <MaterialIcon className="text-[16px]" name="stars" />+{PROFILE_POINTS_PER_ITEM} điểm thi đua cho mỗi mục hoàn
          thành (tối đa {PROFILE_POINTS_PER_ITEM * PROFILE_ITEM_COUNT} điểm)
        </p>
      </div>
      <MemberProfileForm initial={profile} />
    </div>
  );
}
