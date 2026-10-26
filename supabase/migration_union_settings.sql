-- Cài đặt công đoàn (Union settings): Danh mục chức danh & Danh sách cán bộ công đoàn.
-- - cdilv_union_positions: danh mục chức danh (mặc định: Chủ tịch, Phó chủ tịch, Ủy viên, Kế toán).
--   Quản trị viên có thể thêm chức danh mới, đổi tên hoặc ngừng dùng (is_active = false).
-- - cdilv_union_officers: danh sách cán bộ công đoàn (họ tên, liên kết tùy chọn tới cdilv_profiles,
--   chức danh, thứ tự hiển thị, trạng thái hoạt động, nhiệm kỳ tùy chọn).
-- - Dùng để gợi ý tự động "Họ tên - Chức danh" ở ô thành phần tham gia khi soạn văn bản / biên bản họp.
-- - Quyền truy cập: chỉ service_role qua API máy chủ (RLS giống các bảng quản trị khác).

begin;

create table if not exists public.cdilv_union_positions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  updated_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cdilv_union_positions_name_lower_key
  on public.cdilv_union_positions (lower(btrim(name)));

create index if not exists cdilv_union_positions_active_order_idx
  on public.cdilv_union_positions (is_active, display_order, created_at);

-- 4 chức danh mặc định: Chủ tịch, Phó chủ tịch, Ủy viên, Kế toán
insert into public.cdilv_union_positions (name, display_order, is_active)
select v.name, v.display_order, true
from (
  values
    ('Chủ tịch', 1),
    ('Phó chủ tịch', 2),
    ('Ủy viên', 3),
    ('Kế toán', 4)
) as v(name, display_order)
where not exists (
  select 1
  from public.cdilv_union_positions p
  where lower(btrim(p.name)) = lower(btrim(v.name))
);

create table if not exists public.cdilv_union_officers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.cdilv_profiles(id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 160),
  position_id uuid not null references public.cdilv_union_positions(id) on delete restrict,
  display_order integer not null default 0,
  is_active boolean not null default true,
  term text check (term is null or char_length(btrim(term)) <= 120),
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  updated_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cdilv_union_officers_active_order_idx
  on public.cdilv_union_officers (is_active, display_order, created_at);

create index if not exists cdilv_union_officers_position_idx
  on public.cdilv_union_officers (position_id);

create index if not exists cdilv_union_officers_user_idx
  on public.cdilv_union_officers (user_id);

-- RLS & phân quyền: chỉ service_role truy cập (quyền kiểm tra ở API máy chủ)
alter table public.cdilv_union_positions enable row level security;
alter table public.cdilv_union_officers enable row level security;

revoke all on public.cdilv_union_positions, public.cdilv_union_officers from anon, authenticated;
revoke truncate on public.cdilv_union_positions, public.cdilv_union_officers from service_role;
grant select, insert, update, delete on public.cdilv_union_positions, public.cdilv_union_officers to service_role;

commit;

notify pgrst, 'reload schema';
