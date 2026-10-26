import { redirect } from "next/navigation";
import { PrintLogoSettings } from "@/components/forms/PrintLogoSettings";
import { PrintSettingsForm } from "@/components/forms/PrintSettingsForm";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadFormSettings } from "@/lib/forms/settings-server";
import { printLogoUrl } from "@/lib/print/logo";
import { loadPrintLogoPath } from "@/lib/print/logo-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function PrintSettingsPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/administration/print-settings");
  if (!hasPermission(access, PERMISSIONS.formsSettings)) redirect("/");

  const db = createServiceClient();
  const [settings, logoPath] = await Promise.all([
    loadFormSettings(db),
    access.isAdmin ? loadPrintLogoPath(db) : Promise.resolve(null),
  ]);

  return (
    <div className="max-w-3xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Cài đặt biểu mẫu in</h1>
          <p className="text-sm text-on-surface-variant">
            Người ký thay đổi theo nhiệm kỳ: sửa ở đây, mọi phiếu in sau đó tự cập nhật.
          </p>
        </div>
      </div>
      {access.isAdmin ? <PrintLogoSettings initialUrl={printLogoUrl(logoPath)} /> : null}
      <PrintSettingsForm initial={settings} />
    </div>
  );
}
