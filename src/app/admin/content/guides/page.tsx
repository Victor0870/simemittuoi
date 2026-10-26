import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminGuidePostsManager } from "@/components/admin/AdminGuidePostsManager";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { BRAND } from "@/lib/brand";
import { getPostDetails } from "@/lib/data/posts";
import { GUIDE_POST_CATEGORY } from "@/lib/post-categories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Quản lý ${GUIDE_POST_CATEGORY.tag} | ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default async function AdminGuidePostsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const access = await getCurrentAccess();
  if (!access) {
    redirect("/login?next=/admin/content/guides");
  }
  if (!hasPermission(access, PERMISSIONS.postsManage)) {
    redirect("/");
  }

  const [posts, params] = await Promise.all([
    getPostDetails(200, { includeInactive: true, tag: GUIDE_POST_CATEGORY.tag }),
    searchParams,
  ]);

  return <AdminGuidePostsManager editId={params.edit ?? null} openCreate={params.new === "1"} posts={posts} />;
}
