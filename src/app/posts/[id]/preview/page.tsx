import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostDetailView } from "@/components/posts/PostDetailView";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { getPostById, getPostCommentsCount, getRelatedPosts } from "@/lib/data/posts";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Xem trước bài viết | ${BRAND.name}`,
  robots: { index: false, follow: false },
};

type PostPreviewPageProps = {
  params: Promise<{ id: string }>;
};

/** Xem bài Inactive / hẹn giờ: render theo từng yêu cầu, chỉ người có quyền quản lý bài viết. */
export default async function PostPreviewPage({ params }: PostPreviewPageProps) {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();

  if (!post.isActive || post.isScheduled) {
    const access = await getCurrentAccess();
    if (!access || !hasPermission(access, PERMISSIONS.postsManage)) notFound();
  }

  const [related, commentCount] = await Promise.all([
    getRelatedPosts(post.id, 6),
    getPostCommentsCount(post.id),
  ]);

  return <PostDetailView commentCount={commentCount} post={post} related={related} />;
}
