import { redirect } from "next/navigation";
import { DocumentComposer } from "@/components/documents/DocumentComposer";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { loadDocumentDrafts } from "@/lib/documents/drafts-server";
import { loadDocumentOrgSettings } from "@/lib/documents/settings-server";
import { loadDocumentTemplates } from "@/lib/documents/templates-server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadUnionOfficers } from "@/lib/union-settings/server";
import { canManageUnionSettings, toOfficerSuggestion } from "@/lib/union-settings/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentComposePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string | string[] }>;
}) {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/documents/compose");
  if (!hasPermission(access, PERMISSIONS.postsManage)) redirect("/");

  const { draft } = await searchParams;
  const db = createServiceClient();
  const [templates, settings, drafts, officers] = await Promise.all([
    loadDocumentTemplates(db),
    loadDocumentOrgSettings(db),
    loadDocumentDrafts(db),
    loadUnionOfficers(db, { activeOnly: true }),
  ]);
  return (
    <DocumentComposer
      initialDraftId={typeof draft === "string" ? draft : null}
      initialDrafts={drafts}
      canManageUnionSettings={canManageUnionSettings(access)}
      isAdmin={access.isAdmin}
      officers={officers.map(toOfficerSuggestion)}
      settings={settings}
      templates={templates}
    />
  );
}
