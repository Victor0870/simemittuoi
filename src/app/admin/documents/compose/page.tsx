import { redirect } from "next/navigation";
import { DocumentComposer } from "@/components/documents/DocumentComposer";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadDocumentDrafts } from "@/lib/documents/drafts-server";
import { loadDocumentOrgSettings } from "@/lib/documents/settings-server";
import { loadDocumentTemplates } from "@/lib/documents/templates-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentComposePage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/documents/compose");
  if (!hasPermission(access, PERMISSIONS.postsManage)) redirect("/");

  const db = createServiceClient();
  const [templates, settings, drafts] = await Promise.all([
    loadDocumentTemplates(db),
    loadDocumentOrgSettings(db),
    loadDocumentDrafts(db),
  ]);
  return <DocumentComposer initialDrafts={drafts} settings={settings} templates={templates} />;
}
