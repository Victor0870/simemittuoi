-- Security Advisor: view public.cdilv_leaderboard_public bị báo SECURITY DEFINER (lint 0010).
-- Khách cần xem BXH công khai trong khi cdilv_leaderboard_cache chỉ cho đoàn viên đã duyệt đọc,
-- nên số liệu đi qua hàm security definer chỉ trả các cột công khai (không có employee_code).
-- View chuyển sang security_invoker; tên view và cột giữ nguyên, code web không phải đổi.

begin;

create or replace function public.cdilv_get_leaderboard_public()
returns table (
  id uuid,
  full_name text,
  department text,
  avatar_url text,
  total_score integer,
  rank integer
)
language sql
security definer
stable
set search_path = public
as $$
  select l.id, l.full_name, l.department, l.avatar_url, l.total_score, l.rank
  from public.cdilv_leaderboard_cache l
  where l.total_score > 0;
$$;

revoke all on function public.cdilv_get_leaderboard_public() from public;
grant execute on function public.cdilv_get_leaderboard_public() to anon, authenticated, service_role;

create or replace view public.cdilv_leaderboard_public
with (security_invoker = true)
as
  select b.id, b.full_name, b.department, b.avatar_url, b.total_score, b.rank
  from public.cdilv_get_leaderboard_public() as b;

alter view public.cdilv_leaderboard_public set (security_invoker = true);

revoke all on public.cdilv_leaderboard_public from public, anon, authenticated, service_role;
grant select on public.cdilv_leaderboard_public to anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';
