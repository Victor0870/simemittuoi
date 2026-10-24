/**
 * Chuyên mục bài viết dựa trên cột tag sẵn có của cdilv_posts (không có bảng chuyên mục riêng).
 * Bài thuộc chuyên mục = bài có tag trùng tên chuyên mục (không phân biệt hoa thường).
 */
export type PostCategory = {
  slug: string;
  tag: string;
  href: string;
};

export const GUIDE_POST_CATEGORY = {
  slug: "huong-dan",
  tag: "Hướng dẫn sử dụng",
  href: "/huong-dan",
} as const satisfies PostCategory;

const POST_CATEGORIES: readonly PostCategory[] = [GUIDE_POST_CATEGORY];

export function postCategoryBySlug(slug: string | null | undefined): PostCategory | null {
  if (!slug) return null;
  return POST_CATEGORIES.find((c) => c.slug === slug) ?? null;
}
