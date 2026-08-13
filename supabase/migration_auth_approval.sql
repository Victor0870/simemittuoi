-- Migration: mã nhân viên + phê duyệt admin + whitelist
-- Chạy: node scripts/apply-schema.mjs (sau khi cập nhật) hoặc SQL Editor

-- Whitelist mã nhân viên (từ file Excel)
create table if not exists public.employee_whitelist (
  employee_code text primary key,
  full_name text not null,
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Bổ sung cột profiles
alter table public.profiles
  add column if not exists employee_code text,
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id);

-- Constraint approval_status
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_approval_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

-- Unique employee_code (chỉ khi không null)
create unique index if not exists profiles_employee_code_unique
  on public.profiles (employee_code)
  where employee_code is not null;

-- Trigger cập nhật: lưu mã NV + pending khi đăng ký
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_name text;
  v_dept text;
begin
  v_code := nullif(trim(coalesce(new.raw_user_meta_data->>'employee_code', '')), '');
  v_name := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    split_part(new.email, '@', 1)
  );
  v_dept := nullif(trim(coalesce(new.raw_user_meta_data->>'department', '')), '');

  insert into public.profiles (id, full_name, department, employee_code, role, approval_status)
  values (new.id, v_name, v_dept, v_code, 'user', 'pending')
  on conflict (id) do update set
    full_name = excluded.full_name,
    department = coalesce(excluded.department, public.profiles.department),
    employee_code = coalesce(excluded.employee_code, public.profiles.employee_code);

  return new;
end;
$$;

-- RPC kiểm tra mã NV trước khi đăng ký (không lộ toàn bộ whitelist)
create or replace function public.validate_employee_for_signup(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_row public.employee_whitelist%rowtype;
begin
  if v_code is null or v_code = '' then
    return json_build_object('ok', false, 'message', 'Vui lòng nhập mã nhân viên.');
  end if;

  select * into v_row
  from public.employee_whitelist
  where upper(employee_code) = v_code and is_active = true;

  if not found then
    return json_build_object(
      'ok', false,
      'message', 'Mã nhân viên không hợp lệ hoặc chưa được cấp quyền đăng ký.'
    );
  end if;

  if exists (
    select 1 from public.profiles
    where upper(employee_code) = v_code
  ) then
    return json_build_object(
      'ok', false,
      'message', 'Mã nhân viên này đã được đăng ký. Vui lòng đăng nhập hoặc liên hệ admin.'
    );
  end if;

  return json_build_object(
    'ok', true,
    'employee_code', v_row.employee_code,
    'full_name', v_row.full_name,
    'department', v_row.department,
    'message', 'Mã nhân viên hợp lệ.'
  );
end;
$$;

grant execute on function public.validate_employee_for_signup(text) to anon, authenticated;

-- RLS whitelist: không cho đọc trực tiếp (chỉ qua RPC)
alter table public.employee_whitelist enable row level security;

drop policy if exists "whitelist_admin_read" on public.employee_whitelist;
create policy "whitelist_admin_read" on public.employee_whitelist
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and approval_status = 'approved'
    )
  );

drop policy if exists "whitelist_admin_write" on public.employee_whitelist;
create policy "whitelist_admin_write" on public.employee_whitelist
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and approval_status = 'approved'
    )
  );

-- Profiles: admin cập nhật (duyệt / từ chối / đổi role)
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

-- User xem/cập nhật chính mình (không tự đổi approval/role)
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and approval_status = (select approval_status from public.profiles where id = auth.uid())
  );

grant select, insert, update on public.employee_whitelist to authenticated;
grant select on public.employee_whitelist to anon;
-- insert/update whitelist chỉ qua admin policy

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
