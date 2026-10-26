import { redirect } from "next/navigation";
import { HubPage, type HubKpi, type HubTile } from "@/components/admin/HubPage";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { countDocumentDrafts } from "@/lib/documents/drafts-server";
import { countIssuedDocuments } from "@/lib/documents/registry-server";
import { countDocumentTemplates } from "@/lib/documents/templates-server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentsHubPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/documents");

  const canTemplates = hasPermission(access, PERMISSIONS.postsManage);
  const db = canTemplates ? createServiceClient() : null;
  const [counts, draftCount, issuedCount] = db
    ? await Promise.all([countDocumentTemplates(db), countDocumentDrafts(db), countIssuedDocuments(db)])
    : [null, 0, 0];

  const kpis: HubKpi[] = counts
    ? [
        { label: "Mẫu đang dùng", value: counts.active, icon: "task_alt" },
        { label: "Tổng số mẫu", value: counts.total, icon: "description" },
        { label: "Bản nháp", value: draftCount, icon: "edit_note" },
        { label: "Đã ban hành", value: issuedCount, icon: "menu_book" },
      ]
    : [];

  const tiles: (HubTile & { allowed: boolean })[] = [
    {
      href: "/admin/documents/templates",
      title: "Mẫu văn bản",
      description: "Thư viện mẫu Quyết định, Quy định, Biên bản làm việc, Biên bản cuộc họp với các chỗ trống cần điền.",
      icon: "description",
      tint: "dusty",
      allowed: canTemplates,
    },
    {
      href: "/admin/documents/compose",
      title: "Soạn văn bản",
      description: "Chọn mẫu, điền thông tin theo form, lưu nháp và xuất file Word (.docx).",
      icon: "edit_document",
      tint: "surface",
      allowed: canTemplates,
    },
    {
      href: "/admin/documents/registry",
      title: "Sổ văn bản đã ban hành",
      description: "Ban hành bản nháp kèm bản scan đã ký, tra cứu theo loại, năm, số và tải lại bản scan / .docx.",
      icon: "menu_book",
      tint: "amber",
      allowed: canTemplates,
    },
    {
      href: "/admin/union-settings",
      title: "Cài đặt công đoàn",
      description: "Danh sách cán bộ công đoàn, chức danh và nhiệm kỳ dùng để gợi ý thành phần tham gia khi soạn văn bản, biên bản họp.",
      icon: "badge",
      tint: "surface",
      allowed: canTemplates || hasPermission(access, PERMISSIONS.formsSettings),
    },
  ];

  return (
    <HubPage
      kpis={kpis}
      subtitle="Mẫu văn bản, soạn văn bản và sổ văn bản đã ban hành"
      tiles={tiles.filter((t) => t.allowed)}
      title="Văn bản công đoàn"
    />
  );
}
