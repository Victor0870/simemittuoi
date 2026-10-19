-- =============================================================================
-- Bước 1 – Phân quyền theo cấp (RBAC)
-- - Cấp (vai trò) do admin tự tạo/sửa/xóa: Manager, Kế toán, Ủy viên, Support…
-- - Quyền của từng cấp do admin tick chọn; danh mục quyền khai báo trong code
--   (src/lib/auth/permissions.ts) nên module mới chỉ cần thêm quyền vào danh mục.
-- - cdilv_profiles.role = 'admin' (Chủ tịch) luôn có toàn quyền, không phụ thuộc bảng này.
-- =============================================================================

create table if not exists public.cdilv_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cdilv_roles_name_unique
  on public.cdilv_roles (lower(name));

create table if not exists public.cdilv_role_permissions (
  role_id uuid not null references public.cdilv_roles(id) on delete cascade,
  permission_code text not null,
  primary key (role_id, permission_code)
);

create table if not exists public.cdilv_user_roles (
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  role_id uuid not null references public.cdilv_roles(id) on delete cascade,
  granted_by uuid references public.cdilv_profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists cdilv_user_roles_role_idx
  on public.cdilv_user_roles (role_id);

-- Nhật ký thay đổi phân quyền (chỉ ghi thêm qua API máy chủ)
create table if not exists public.cdilv_permission_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.cdilv_profiles(id) on delete set null,
  action text not null,
  role_id uuid,
  role_name text,
  target_user_id uuid references public.cdilv_profiles(id) on delete set null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_permission_logs_created_idx
  on public.cdilv_permission_logs (created_at desc);

-- -----------------------------------------------------------------------------
-- Hàm kiểm tra quyền (dùng trong RLS, API, middleware)
-- -----------------------------------------------------------------------------
create or replace function public.cdilv_has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cdilv_profiles p
    where p.id = auth.uid()
      and p.approval_status = 'approved'
      and (
        p.role = 'admin'
        or exists (
          select 1
          from public.cdilv_user_roles ur
          join public.cdilv_role_permissions rp on rp.role_id = ur.role_id
          where ur.user_id = p.id
            and rp.permission_code = p_code
        )
      )
  );
$$;

create or replace function public.cdilv_my_permissions()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'is_admin', coalesce(p.role = 'admin' and p.approval_status = 'approved', false),
    'is_approved', coalesce(p.approval_status = 'approved', false),
    'permissions', case when p.approval_status = 'approved' then coalesce((
      select json_agg(distinct rp.permission_code)
      from public.cdilv_user_roles ur
      join public.cdilv_role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = p.id
    ), '[]'::json) else '[]'::json end,
    'roles', coalesce((
      select json_agg(json_build_object('id', r.id, 'name', r.name) order by r.sort_order, r.name)
      from public.cdilv_user_roles ur
      join public.cdilv_roles r on r.id = ur.role_id
      where ur.user_id = p.id
    ), '[]'::json)
  )
  from public.cdilv_profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.cdilv_has_permission(text) from public;
revoke all on function public.cdilv_my_permissions() from public;
grant execute on function public.cdilv_has_permission(text) to authenticated, service_role;
grant execute on function public.cdilv_my_permissions() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS: trình duyệt chỉ được đọc; mọi thao tác ghi đi qua API máy chủ (service role)
-- -----------------------------------------------------------------------------
alter table public.cdilv_roles enable row level security;
alter table public.cdilv_role_permissions enable row level security;
alter table public.cdilv_user_roles enable row level security;
alter table public.cdilv_permission_logs enable row level security;

drop policy if exists "cdilv_roles_read" on public.cdilv_roles;
create policy "cdilv_roles_read" on public.cdilv_roles
  for select to authenticated using (true);

drop policy if exists "cdilv_role_permissions_read" on public.cdilv_role_permissions;
create policy "cdilv_role_permissions_read" on public.cdilv_role_permissions
  for select to authenticated using (true);

drop policy if exists "cdilv_user_roles_read" on public.cdilv_user_roles;
create policy "cdilv_user_roles_read" on public.cdilv_user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_permission_logs_admin_read" on public.cdilv_permission_logs;
create policy "cdilv_permission_logs_admin_read" on public.cdilv_permission_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

revoke all on
  public.cdilv_roles,
  public.cdilv_role_permissions,
  public.cdilv_user_roles,
  public.cdilv_permission_logs
from anon, authenticated;

grant select on
  public.cdilv_roles,
  public.cdilv_role_permissions,
  public.cdilv_user_roles,
  public.cdilv_permission_logs
to authenticated;

grant select, insert, update, delete on
  public.cdilv_roles,
  public.cdilv_role_permissions,
  public.cdilv_user_roles,
  public.cdilv_permission_logs
to service_role;

-- -----------------------------------------------------------------------------
-- Danh sách nhân viên: chuyển từ "chỉ admin" sang quyền employees.view / employees.manage
-- (admin vẫn có toàn quyền nên không ảnh hưởng hiện trạng)
-- -----------------------------------------------------------------------------
drop policy if exists "cdilv_whitelist_admin_read" on public.cdilv_employee_whitelist;
drop policy if exists "cdilv_whitelist_read" on public.cdilv_employee_whitelist;
create policy "cdilv_whitelist_read" on public.cdilv_employee_whitelist
  for select to authenticated
  using (public.cdilv_has_permission('employees.view'));

drop policy if exists "cdilv_whitelist_admin_write" on public.cdilv_employee_whitelist;
drop policy if exists "cdilv_whitelist_write" on public.cdilv_employee_whitelist;
create policy "cdilv_whitelist_write" on public.cdilv_employee_whitelist
  for all to authenticated
  using (public.cdilv_has_permission('employees.manage'))
  with check (public.cdilv_has_permission('employees.manage'));

-- -----------------------------------------------------------------------------
-- Cấp mặc định, chưa có quyền nào (admin tự tick quyền, đổi tên hoặc xóa).
-- Danh sách nhân viên mặc định chỉ admin xem; đoàn viên không có cấp nào.
-- -----------------------------------------------------------------------------
insert into public.cdilv_roles (name, description, sort_order)
values
  ('Manager', 'Cán bộ hỗ trợ Chủ tịch: in phiếu, làm thủ tục thanh toán', 10),
  ('Kế toán', 'Quản lý thu chi tài chính công đoàn', 20)
on conflict do nothing;

notify pgrst, 'reload schema';
