import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberProfileForm } from "@/components/members/MemberProfileForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { loadMemberProfile } from "@/lib/members/profile-server";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Hồ sơ đoàn viên | CDILV.VN",
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
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Hồ sơ đoàn viên</h1>
          <p className="text-sm text-on-surface-variant">
            Thông tin phục vụ giấy tờ hành chính công đoàn. Chỉ bạn và người được phân quyền xem được.
          </p>
        </div>
        <Link
          className="flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
          href="/settings"
        >
          <MaterialIcon className="text-[18px]" name="arrow_back" />
          Cài đặt
        </Link>
      </div>
      <MemberProfileForm initial={profile} />
    </div>
  );
}
