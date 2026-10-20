-- =============================================================================
-- Popup dạng ảnh: ảnh (poster, thông báo dạng hình) thay cho nội dung chữ.
-- - image_path: đường dẫn trong bucket cdilv-popups (ảnh công khai vì popup có thể
--   hiện cho cả khách); tải lên qua API máy chủ (service role).
-- - Nội dung chữ không bắt buộc khi có ảnh.
-- Chạy: node scripts/apply-popup-image.mjs
-- =============================================================================

alter table public.cdilv_popups
  add column if not exists image_path text check (image_path is null or char_length(image_path) <= 300);

alter table public.cdilv_popups alter column body set default '';
alter table public.cdilv_popups drop constraint if exists cdilv_popups_body_check;
alter table public.cdilv_popups drop constraint if exists cdilv_popups_content;
alter table public.cdilv_popups add constraint cdilv_popups_content check (
  char_length(body) <= 1000
  and (image_path is not null or char_length(trim(body)) >= 1)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cdilv-popups',
  'cdilv-popups',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
