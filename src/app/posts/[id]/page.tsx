import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PostDetailView } from "@/components/posts/PostDetailView";
import { getPostById, getPostCommentsCount, getRelatedPosts } from "@/lib/data/posts";
import { BRAND } from "@/lib/brand";
import { stripPostFormatting } from "@/lib/post-format";

// Bài đang hiển thị được cache chung (ISR, render theo yêu cầu lần đầu).
// Bài Inactive / hẹn giờ chuyển sang /posts/[id]/preview (render động, kiểm tra quyền).
export const revalidate = 60;

export async function generateStaticParams() {
  return [];
}

type PostDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PostDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) {
    return {
      title: `Bài viết | ${BRAND.name}`,
    };
  }

  const title = `${post.title} | ${BRAND.name}`;
  const description = post.excerpt || stripPostFormatting(post.content).slice(0, 160).trim();
  const canonicalPath = `/posts/${post.id}`;
  const images = post.imageUrl ? [{ url: post.imageUrl }] : [];

  return {
    title,
    description,
    openGraph: {
      title: post.title,
      description,
      url: canonicalPath,
      siteName: BRAND.name,
      type: "article",
      publishedTime: post.publishedAt,
      images,
    },
    twitter: {
      card: post.imageUrl ? "summary_large_image" : "summary",
      title: post.title,
      description,
      images: post.imageUrl ? [post.imageUrl] : [],
    },
  };
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();

  if (!post.isActive || post.isScheduled) {
    redirect(`/posts/${encodeURIComponent(post.id)}/preview`);
  }

  const [related, commentCount] = await Promise.all([
    getRelatedPosts(post.id, 6),
    getPostCommentsCount(post.id),
  ]);

  return <PostDetailView commentCount={commentCount} post={post} related={related} />;
}
