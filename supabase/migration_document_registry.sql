-- Văn bản công đoàn – Sổ văn bản đã ban hành.
-- cong_khai: cờ đánh dấu văn bản được phép công khai cho đoàn viên (bước sau mới dùng; hiện chỉ lưu).
-- Ràng buộc: văn bản đã ban hành phải có số, ngày ban hành, bản scan; số không trùng trong cùng loại và cùng năm.
-- Bucket riêng tư cdilv-documents: bản scan đã ký, đóng dấu (PDF / ảnh, tối đa 10 MB).
--   Không có policy trên storage.objects: chỉ service role đọc ghi, trình duyệt chỉ mở qua link ký hạn ngắn từ API.
-- Không đổi dữ liệu, không có dữ liệu mẫu.

begin;

alter table public.cdilv_documents
  add column if not exists cong_khai boolean not null default false;

alter table public.cdilv_documents
  drop constraint if exists cdilv_documents_issued_check;
alter table public.cdilv_documents
  add constraint cdilv_documents_issued_check check (
    status <> 'da_ban_hanh'
    or (
      so_van_ban is not null and char_length(btrim(so_van_ban)) between 1 and 60
      and ngay_ban_hanh is not null
      and scan_path is not null
      and issued_at is not null
    )
  );

create unique index if not exists cdilv_documents_issued_number_idx
  on public.cdilv_documents (type, lower(btrim(so_van_ban)), (extract(year from ngay_ban_hanh)))
  where status = 'da_ban_hanh';

create index if not exists cdilv_documents_issued_date_idx
  on public.cdilv_documents (ngay_ban_hanh desc)
  where status = 'da_ban_hanh';

alter table public.cdilv_documents enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cdilv-documents',
  'cdilv-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;

notify pgrst, 'reload schema';
