"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PostCard } from "@/components/posts/PostCard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { PostSummary } from "@/lib/data/posts";

/**
 * Trang /posts được cache chung (chỉ bài đang hiển thị). Người có quyền quản lý bài viết
 * tải thêm danh sách đầy đủ (gồm bài Inactive / hẹn giờ) qua API có kiểm tra quyền.
 */
export function PostsListClient({
  initialPosts,
  categorySlug,
  emptyMessage = "Chưa có bài viết nào. Vui lòng quay lại sau.",
}: {
  initialPosts: PostSummary[];
  /** Chỉ lấy bài thuộc chuyên mục (slug trong post-categories). */
  categorySlug?: string;
  emptyMessage?: string;
}) {
  const { can, loading, user } = useAuth();
  const canManage = !loading && can(PERMISSIONS.postsManage);
  const userId = user?.id ?? null;
  const [managePosts, setManagePosts] = useState<PostSummary[] | null>(null);

  useEffect(() => {
    if (!canManage) {
      setManagePosts(null);
      return;
    }

    let cancelled = false;
    const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : "";
    fetch(`/api/posts/manage-list${query}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ posts: PostSummary[] }>) : null))
      .catch(() => null)
      .then((data) => {
        if (!cancelled && data) setManagePosts(data.posts);
      });

    return () => {
      cancelled = true;
    };
  }, [canManage, userId, initialPosts, categorySlug]);

  const posts = managePosts ?? initialPosts;

  if (posts.length === 0) {
    return (
      <p className="rounded-2xl border border-dusty-border bg-white px-4 py-12 text-center text-sm text-on-surface-variant">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
