-- =============================================================================
-- Bước 2 – Hồ sơ cá nhân đoàn viên
-- - Tách khỏi cdilv_profiles (bảng đó đang đọc công khai cho bảng xếp hạng).
-- - Mọi truy cập đi qua API máy chủ (service role): RLS bật, không mở policy nào
--   cho anon/authenticated → trình duyệt không đọc/ghi trực tiếp được.
-- - Số CCCD được mã hóa AES-256-GCM ở máy chủ Next.js (khóa CDILV_IDENTITY_KEY
--   chỉ nằm trong biến môi trường), database chỉ lưu chuỗi mã hóa + 4 số cuối.
-- =============================================================================

create table if not exists public.cdilv_member_details (
  user_id uuid primary key references public.cdilv_profiles(id) on delete cascade,
  date_of_birth date,
  gender text check (gender in ('male', 'female')),
  phone text,
  permanent_address text,
  current_address text,
  marital_status text,
  -- Đoàn viên xác nhận chưa có con (để mục "Thông tin con" được tính là đã khai)
  no_children boolean not null default false,
  bank_account_no text,
  bank_name text,
  bank_branch text,
  bank_account_holder text,
  consent_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.cdilv_profiles(id) on delete set null
);

-- Nâng cấp bảng đã tạo ở bản nháp trước (chạy lại an toàn)
alter table public.cdilv_member_details drop column if exists is_hardship;
alter table public.cdilv_member_details drop column if exists hardship_note;
alter table public.cdilv_member_details add column if not exists no_children boolean not null default false;
update public.cdilv_member_details
  set marital_status = 'single'
  where marital_status is not null and marital_status not in ('single', 'married');
alter table public.cdilv_member_details drop constraint if exists cdilv_member_details_marital_status_check;
alter table public.cdilv_member_details
  add constraint cdilv_member_details_marital_status_check
  check (marital_status in ('single', 'married'));

-- Diện khó khăn do admin quản lý trong danh sách nhân viên, đoàn viên không thấy.
-- Quyền đọc/sửa theo RLS sẵn có của bảng: employees.view / employees.manage.
alter table public.cdilv_employee_whitelist add column if not exists is_hardship boolean not null default false;
alter table public.cdilv_employee_whitelist add column if not exists hardship_note text;
alter table public.cdilv_employee_whitelist drop constraint if exists cdilv_employee_whitelist_hardship_note_len;
alter table public.cdilv_employee_whitelist
  add constraint cdilv_employee_whitelist_hardship_note_len
  check (hardship_note is null or char_length(hardship_note) <= 500);

create table if not exists public.cdilv_member_children (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  full_name text not null,
  date_of_birth date not null,
  gender text check (gender in ('male', 'female')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cdilv_member_children_member_idx
  on public.cdilv_member_children (member_id);

create index if not exists cdilv_member_children_dob_idx
  on public.cdilv_member_children (date_of_birth);

create table if not exists public.cdilv_member_identity (
  user_id uuid primary key references public.cdilv_profiles(id) on delete cascade,
  id_number_enc text not null,
  -- HMAC-SHA256 của số CCCD (cùng khóa) để phát hiện 2 tài khoản trùng CCCD mà không lộ số
  id_number_hash text not null,
  id_last4 text not null,
  id_issue_date date,
  id_issue_place text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.cdilv_profiles(id) on delete set null
);

create unique index if not exists cdilv_member_identity_hash_unique
  on public.cdilv_member_identity (id_number_hash);

-- Lịch sử sửa hồ sơ: mỗi lần lưu 1 dòng, changes = [{field, label, old, new}] (giá trị nhạy cảm đã che)
create table if not exists public.cdilv_member_change_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  changed_by uuid references public.cdilv_profiles(id) on delete set null,
  changes jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_member_change_logs_member_idx
  on public.cdilv_member_change_logs (member_id, created_at desc);

-- Nhật ký truy cập dữ liệu nhạy cảm (xuất/in có CCCD) – dùng từ các bước in biểu mẫu
create table if not exists public.cdilv_sensitive_access_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.cdilv_profiles(id) on delete set null,
  action text not null,
  target_count integer not null default 0,
  target_ids uuid[],
  reason text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_sensitive_access_logs_created_idx
  on public.cdilv_sensitive_access_logs (created_at desc);

-- Lịch sử chỉ ghi thêm: chặn sửa/xóa (kể cả service role).
-- Ngoại lệ duy nhất: khóa ngoại tự đặt người thao tác = null khi tài khoản đó bị xóa.
create or replace function public.cdilv_guard_member_change_logs()
returns trigger
language plpgsql
as $$
begin
  if new.member_id = old.member_id
     and new.changes = old.changes
     and new.created_at = old.created_at
     and new.changed_by is null then
    return new;
  end if;
  raise exception 'Lịch sử sửa hồ sơ chỉ được ghi thêm, không được sửa.';
end;
$$;

create or replace function public.cdilv_guard_sensitive_access_logs()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.action = old.action
     and new.created_at = old.created_at
     and new.target_count = old.target_count
     and new.target_ids is not distinct from old.target_ids
     and new.reason is not distinct from old.reason
     and new.detail is not distinct from old.detail
     and new.actor_id is null then
    return new;
  end if;
  raise exception 'Nhật ký truy cập dữ liệu nhạy cảm chỉ được ghi thêm, không được sửa hoặc xóa.';
end;
$$;

drop trigger if exists trg_cdilv_member_change_logs_immutable on public.cdilv_member_change_logs;
create trigger trg_cdilv_member_change_logs_immutable
  before update on public.cdilv_member_change_logs
  for each row execute function public.cdilv_guard_member_change_logs();

drop trigger if exists trg_cdilv_sensitive_access_logs_immutable on public.cdilv_sensitive_access_logs;
create trigger trg_cdilv_sensitive_access_logs_immutable
  before update or delete on public.cdilv_sensitive_access_logs
  for each row execute function public.cdilv_guard_sensitive_access_logs();

alter table public.cdilv_member_details enable row level security;
alter table public.cdilv_member_children enable row level security;
alter table public.cdilv_member_identity enable row level security;
alter table public.cdilv_member_change_logs enable row level security;
alter table public.cdilv_sensitive_access_logs enable row level security;

revoke all on
  public.cdilv_member_details,
  public.cdilv_member_children,
  public.cdilv_member_identity,
  public.cdilv_member_change_logs,
  public.cdilv_sensitive_access_logs
from anon, authenticated;

grant select, insert, update, delete on
  public.cdilv_member_details,
  public.cdilv_member_children,
  public.cdilv_member_identity,
  public.cdilv_member_change_logs,
  public.cdilv_sensitive_access_logs
to service_role;

notify pgrst, 'reload schema';
