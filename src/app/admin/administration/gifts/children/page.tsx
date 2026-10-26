import { redirect } from "next/navigation";
import { ChildrenGiftList } from "@/components/gifts/ChildrenGiftList";
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
  if (!access) redirect("/login?next=/admin/administration/gifts/children");
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
      </div>
      <ChildrenGiftList items={items} maxAge={filter.maxAge} refDate={filter.refDate} />
    </div>
  );
}
