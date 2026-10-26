import Link from "next/link";
import { redirect } from "next/navigation";
import { FundEntryForm } from "@/components/finance/FundEntryForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import type { EntryKind } from "@/lib/finance/registry";
import { loadCategories, loadFunds, loadLockedThrough } from "@/lib/finance/server";
import { todayInVietnam } from "@/lib/life-events/registry";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ kind?: string }> };

export default async function NewFundEntryPage({ searchParams }: PageProps) {
  const { kind: rawKind } = await searchParams;
  const kind: EntryKind = rawKind === "expense" || rawKind === "transfer" ? rawKind : "income";
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/admin/finance/ledger/new?kind=${kind}`);
  if (!hasPermission(access, PERMISSIONS.financeRecord)) redirect("/admin/finance/ledger");

  const db = createServiceClient();
  const [funds, categories, lockedThrough] = await Promise.all([loadFunds(db), loadCategories(db), loadLockedThrough(db)]);
  const active = funds.filter((f) => f.is_active);
  const cash = active.find((f) => f.kind === "cash");
  const bank = active.find((f) => f.kind === "bank");
  const fundId = kind === "transfer" ? (bank ?? active[0])?.id : (kind === "income" ? (bank ?? cash) : (cash ?? bank))?.id;
  const toFundId = kind === "transfer" ? active.find((f) => f.id !== fundId)?.id : undefined;

  return (
    <div className="max-w-3xl space-y-4 pb-10">
      <Link
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
        href="/admin/finance/ledger"
      >
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        Sổ quỹ
      </Link>
      <div>
        <h1 className="text-headline-md font-extrabold text-[#173A67]">Ghi sổ quỹ</h1>
        <p className="text-sm text-on-surface-variant">
          Số phiếu (PT / PC / CK) tự cấp khi lưu. Bút toán sai thì sửa hoặc hủy có lý do – không xóa khỏi sổ.
        </p>
      </div>
      <FundEntryForm
        categories={categories}
        funds={funds}
        initial={{
          kind,
          entryDate: todayInVietnam(),
          fundId: fundId ?? "",
          toFundId: toFundId ?? "",
          categoryId: "",
          amount: "",
          description: "",
          counterparty: "",
          documentNo: "",
        }}
        lockedThrough={lockedThrough}
        mode="create"
      />
    </div>
  );
}
