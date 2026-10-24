import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegulationDocument } from "@/components/finance/RegulationDocument";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { BRAND } from "@/lib/brand";
import { loadSpendingRegulation } from "@/lib/finance/regulation-server";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Quy chế chi tiêu | ${BRAND.name}`,
  description: "Quy chế chi tiêu của Công đoàn cơ sở.",
};

export default async function SpendingRegulationPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/quy-che-chi-tieu");
  if (!access.isApproved) redirect("/pending");

  const db = createServiceClient();
  const [{ regulation, updatedAt }, forms] = await Promise.all([loadSpendingRegulation(db), loadFormSettings(db)]);

  return (
    <RegulationDocument
      canEdit={hasPermission(access, PERMISSIONS.financeManage)}
      regulation={regulation}
      unionName={forms.unionName}
      updatedAt={updatedAt}
    />
  );
}
