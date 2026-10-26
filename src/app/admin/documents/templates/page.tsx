import { redirect } from "next/navigation";
import { DocumentTemplatesManager } from "@/components/documents/DocumentTemplatesManager";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadDocumentOrgSettings } from "@/lib/documents/settings-server";
import { loadDocumentTemplates } from "@/lib/documents/templates-server";
import { createServiceClient } from "@/lib/supabase/service";
import { canManageUnionSettings } from "@/lib/union-settings/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentTemplatesPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/documents/templates");
  if (!hasPermission(access, PERMISSIONS.postsManage)) redirect("/");

  const db = createServiceClient();
  const [templates, initialSettings] = await Promise.all([
    loadDocumentTemplates(db),
    loadDocumentOrgSettings(db),
  ]);
  return (
    <DocumentTemplatesManager
      canManageUnionSettings={canManageUnionSettings(access)}
      initialSettings={initialSettings}
      templates={templates}
    />
  );
}
