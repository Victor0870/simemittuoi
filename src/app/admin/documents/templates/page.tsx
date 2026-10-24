import { redirect } from "next/navigation";
import { DocumentTemplatesManager } from "@/components/documents/DocumentTemplatesManager";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadDocumentTemplates } from "@/lib/documents/templates-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentTemplatesPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/documents/templates");
  if (!hasPermission(access, PERMISSIONS.postsManage)) redirect("/");

  const templates = await loadDocumentTemplates(createServiceClient());
  return <DocumentTemplatesManager templates={templates} />;
}
