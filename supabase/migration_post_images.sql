-- =============================================================================
-- Ảnh bài viết: ảnh đại diện (cdilv_posts.image_url, cột đã có sẵn) và ảnh chèn
-- trong nội dung (cú pháp ![mô tả](url)).
-- - Bucket cdilv-post-images công khai (bài viết hiện cho cả khách).
-- - Tải lên chỉ qua API máy chủ /api/posts/images (service role, kiểm tra quyền
--   posts.manage) nên không cần policy ghi cho anon/authenticated.
-- - Không sửa hay xóa dữ liệu bài viết hiện có.
-- Chạy: supabase db query --linked -f supabase/migration_post_images.sql
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cdilv-post-images',
  'cdilv-post-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
