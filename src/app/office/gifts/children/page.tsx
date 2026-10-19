import Link from "next/link";
import { redirect } from "next/navigation";
import { ChildrenGiftList } from "@/components/gifts/ChildrenGiftList";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { parseGiftFilter } from "@/lib/gifts/children-gifts";
import { loadChildrenGiftList } from "@/lib/gifts/children-gifts-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{ date?: string | string[]; age?: string | string[] }>;
};

export default async function ChildrenGiftsPage({ searchParams }: PageProps) {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/office/gifts/children");
  if (!hasPermission(access, PERMISSIONS.giftsChildren)) redirect("/");

  const filter = parseGiftFilter(await searchParams);
  const items = await loadChildrenGiftList(createServiceClient(), filter);

  return (
    <div className="space-y-5 pb-10 print:space-y-0 print:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Quà thiếu nhi</h1>
          <p className="text-sm text-on-surface-variant">
            Con của đoàn viên dưới độ tuổi quy định, tính tuổi tròn tại mốc ngày chọn. Cháu được cả bố và mẹ cùng
            khai sẽ được gộp, chỉ tính 1 suất.
          </p>
        </div>
        <Link
          className="flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
          href={access.isAdmin ? "/admin" : "/office"}
        >
          <MaterialIcon className="text-[18px]" name="arrow_back" />
          {access.isAdmin ? "Trang Admin" : "Khu vực quản lý"}
        </Link>
      </div>
      <ChildrenGiftList items={items} maxAge={filter.maxAge} refDate={filter.refDate} />
    </div>
  );
}
