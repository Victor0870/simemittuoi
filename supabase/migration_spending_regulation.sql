-- =============================================================================
-- Quy chế chi tiêu của công đoàn (khung trang, nội dung điền sau).
-- - Lưu 1 dòng trong cdilv_app_settings, key = 'spending_regulation', value jsonb:
--     { "title": text, "regulationNo": text, "effectiveDate": "YYYY-MM-DD" | null, "content": text }
--   content: chữ thường + "# Chương …", "## Điều …", "### …", "- …", "1. …", **đậm**, ![Ảnh](url).
-- - Bảng chỉ service role truy cập (RLS sẵn có); quyền kiểm tra ở API / trang máy chủ:
--   sửa = admin hoặc quyền finance.manage, đọc = đoàn viên đã đăng nhập và được duyệt.
-- - Chỉ thêm dòng trống ban đầu; dòng đã có thì giữ nguyên.
-- Chạy: supabase db query --linked -f supabase/migration_spending_regulation.sql
-- =============================================================================

insert into public.cdilv_app_settings (key, value)
values (
  'spending_regulation',
  jsonb_build_object('title', 'Quy chế chi tiêu', 'regulationNo', '', 'effectiveDate', null, 'content', '')
)
on conflict (key) do nothing;
