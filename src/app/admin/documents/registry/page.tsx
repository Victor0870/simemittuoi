import { redirect } from "next/navigation";
import { DocumentRegistry } from "@/components/documents/DocumentRegistry";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadDocumentDrafts } from "@/lib/documents/drafts-server";
import { loadIssuedDocuments } from "@/lib/documents/registry-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentRegistryPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/documents/registry");
  if (!hasPermission(access, PERMISSIONS.postsManage)) redirect("/");

  const db = createServiceClient();
  const [documents, drafts] = await Promise.all([loadIssuedDocuments(db), loadDocumentDrafts(db)]);
  return <DocumentRegistry initialDocuments={documents} initialDrafts={drafts} isAdmin={access.isAdmin} />;
}
