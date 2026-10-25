-- Văn bản công đoàn – Soạn văn bản: văn bản soạn từ mẫu (cdilv_document_templates).
-- field_values: giá trị các trường của mẫu tại thời điểm lưu, dạng {"khoa": "giá trị"}.
-- status: 'nhap' (bản nháp, sửa / xóa được) hoặc 'da_ban_hanh' (bước Sổ văn bản đã ban hành, làm sau).
-- so_van_ban, ngay_ban_hanh, scan_path, issued_at, issued_by: để trống, dùng cho bước ban hành.
-- Không có dữ liệu mẫu. Đọc / ghi qua API (service role), quyền posts.manage kiểm tra phía server.

begin;

create table if not exists public.cdilv_documents (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.cdilv_document_templates(id) on delete restrict,
  type text not null check (type in ('quyet_dinh', 'quy_dinh', 'bien_ban_lam_viec', 'bien_ban_cuoc_hop')),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  field_values jsonb not null default '{}'::jsonb check (jsonb_typeof(field_values) = 'object'),
  status text not null default 'nhap' check (status in ('nhap', 'da_ban_hanh')),
  so_van_ban text,
  ngay_ban_hanh date,
  scan_path text,
  issued_at timestamptz,
  issued_by uuid references public.cdilv_profiles(id) on delete set null,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cdilv_documents_status_idx
  on public.cdilv_documents (status, updated_at desc);

create index if not exists cdilv_documents_template_idx
  on public.cdilv_documents (template_id);

-- Quyền truy cập: chỉ service role (API kiểm tra quyền posts.manage), giống bảng mẫu văn bản.
-- Bản nháp được xóa hẳn; API chỉ cho xóa khi status = 'nhap'.
alter table public.cdilv_documents enable row level security;

revoke all on public.cdilv_documents from anon, authenticated;
revoke truncate on public.cdilv_documents from service_role;
grant select, insert, update, delete on public.cdilv_documents to service_role;

commit;

notify pgrst, 'reload schema';
