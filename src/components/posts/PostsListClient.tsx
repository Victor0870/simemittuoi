import { PostCard } from "@/components/posts/PostCard";
import type { PostSummary } from "@/lib/data/posts";

/** Danh sách bài đang hiển thị (bản cache chung); bài Inactive / hẹn giờ quản lý ở /admin/content/posts. */
export function PostsListClient({
  initialPosts: posts,
  emptyMessage = "Chưa có bài viết nào. Vui lòng quay lại sau.",
}: {
  initialPosts: PostSummary[];
  emptyMessage?: string;
}) {
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
