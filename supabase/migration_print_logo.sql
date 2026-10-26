-- =============================================================================
-- Logo in trên Giấy đề nghị thanh toán (thay logo in sẵn trong mẫu Excel).
-- - Bucket công khai cdilv-print-assets: ảnh PNG / JPG tối đa 2MB, chỉ tải lên qua API
--   máy chủ (service role, chỉ Quản trị viên); không có policy ghi cho người dùng.
-- - Đường dẫn logo lưu ở cdilv_app_settings (key = 'print_logo', value = {"path": ...}),
--   app tự ghi khi tải lên – không đổi cấu trúc bảng.
-- Chỉ thêm mới, không sửa / xóa dữ liệu có sẵn.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cdilv-print-assets',
  'cdilv-print-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg']
)
on conflict (id) do nothing;
