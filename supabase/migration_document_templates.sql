-- Văn bản công đoàn – Mẫu văn bản: thư viện mẫu theo 4 loại (Quyết định, Quy định, Biên bản làm việc, Biên bản cuộc họp).
-- body: nội dung mẫu có chỗ trống dạng {{khoa}} (VD {{so_van_ban}}, {{ngay}}, {{noi_ban_hanh}}, {{nguoi_ky}}, {{noi_dung}}).
-- fields: danh sách trường để bước "Soạn văn bản" dựng form nhập, thay chỗ trống và xuất .docx.
--   Mỗi phần tử: {"key": "so_van_ban", "label": "Số văn bản", "type": "text|textarea|date|number", "required": true}
-- Không xóa cứng: ngừng dùng bằng is_active = false. Đọc / ghi qua API (service role), quyền kiểm tra phía server.

begin;

create table if not exists public.cdilv_document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  doc_type text not null check (doc_type in ('quyet_dinh', 'quy_dinh', 'bien_ban_lam_viec', 'bien_ban_cuoc_hop')),
  body text not null default '' check (char_length(body) <= 100000),
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  is_active boolean not null default true,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  updated_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cdilv_document_templates_type_idx
  on public.cdilv_document_templates (doc_type, is_active);

-- 4 mẫu trống (mỗi loại một mẫu); chỉ thêm khi loại đó chưa có mẫu nào.
insert into public.cdilv_document_templates (name, doc_type, body, fields)
select v.name, v.doc_type, v.body, f.fields::jsonb
from (
  values
    (
      'Mẫu Quyết định',
      'quyet_dinh',
      E'Số: {{so_van_ban}}\n{{noi_ban_hanh}}, ngày {{ngay}}\n\nQUYẾT ĐỊNH\n(Nội dung mẫu sẽ được cập nhật)\n\n{{noi_dung}}\n\nNGƯỜI KÝ\n{{nguoi_ky}}'
    ),
    (
      'Mẫu Quy định',
      'quy_dinh',
      E'Số: {{so_van_ban}}\n{{noi_ban_hanh}}, ngày {{ngay}}\n\nQUY ĐỊNH\n(Nội dung mẫu sẽ được cập nhật)\n\n{{noi_dung}}\n\nNGƯỜI KÝ\n{{nguoi_ky}}'
    ),
    (
      'Mẫu Biên bản làm việc',
      'bien_ban_lam_viec',
      E'Số: {{so_van_ban}}\n{{noi_ban_hanh}}, ngày {{ngay}}\n\nBIÊN BẢN LÀM VIỆC\n(Nội dung mẫu sẽ được cập nhật)\n\n{{noi_dung}}\n\nNGƯỜI KÝ\n{{nguoi_ky}}'
    ),
    (
      'Mẫu Biên bản cuộc họp',
      'bien_ban_cuoc_hop',
      E'Số: {{so_van_ban}}\n{{noi_ban_hanh}}, ngày {{ngay}}\n\nBIÊN BẢN CUỘC HỌP\n(Nội dung mẫu sẽ được cập nhật)\n\n{{noi_dung}}\n\nNGƯỜI KÝ\n{{nguoi_ky}}'
    )
) as v(name, doc_type, body)
cross join lateral (
  select '[
    {"key": "so_van_ban", "label": "Số văn bản", "type": "text", "required": true},
    {"key": "ngay", "label": "Ngày ban hành", "type": "date", "required": true},
    {"key": "noi_ban_hanh", "label": "Nơi ban hành", "type": "text", "required": false},
    {"key": "nguoi_ky", "label": "Người ký", "type": "text", "required": true},
    {"key": "noi_dung", "label": "Nội dung", "type": "textarea", "required": true}
  ]' as fields
) f
where not exists (select 1 from public.cdilv_document_templates t where t.doc_type = v.doc_type);

-- Quyền truy cập: chỉ service role (API kiểm tra quyền), không xóa cứng.
alter table public.cdilv_document_templates enable row level security;

revoke all on public.cdilv_document_templates from anon, authenticated;
revoke delete, truncate on public.cdilv_document_templates from service_role;
grant select, insert, update on public.cdilv_document_templates to service_role;

commit;

notify pgrst, 'reload schema';
