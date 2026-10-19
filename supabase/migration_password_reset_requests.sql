-- Quên mật khẩu: yêu cầu hỗ trợ gửi tới Ban chấp hành (khi email không tới được đoàn viên)
-- và hàm tra tài khoản CDILV theo email. Mọi truy cập đi qua API server (service role).

create table if not exists public.cdilv_password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  email text not null,
  contact text,
  status text not null default 'pending' check (status in ('pending', 'done', 'dismissed')),
  email_sent boolean not null default false,
  ip text,
  handled_by uuid references public.cdilv_profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_password_reset_requests_status_idx
  on public.cdilv_password_reset_requests (status, created_at desc);
create index if not exists cdilv_password_reset_requests_user_idx
  on public.cdilv_password_reset_requests (user_id, created_at desc);
create index if not exists cdilv_password_reset_requests_ip_idx
  on public.cdilv_password_reset_requests (ip, created_at desc);

alter table public.cdilv_password_reset_requests enable row level security;

revoke all on public.cdilv_password_reset_requests from anon;
revoke all on public.cdilv_password_reset_requests from authenticated;
grant all on public.cdilv_password_reset_requests to service_role;

create or replace function public.cdilv_find_user_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  join public.cdilv_profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.cdilv_find_user_by_email(text) from public;
revoke all on function public.cdilv_find_user_by_email(text) from anon;
revoke all on function public.cdilv_find_user_by_email(text) from authenticated;
grant execute on function public.cdilv_find_user_by_email(text) to service_role;

notify pgrst, 'reload schema';
