-- Tie-break xếp hạng: điểm bằng nhau → ai được cộng điểm trước đứng trước

drop view if exists public.leaderboard;

create view public.leaderboard as
with registered as (
  select
    p.id,
    p.full_name,
    p.department,
    p.avatar_url,
    p.employee_code,
    coalesce(sum(se.points), 0)::integer as total_score,
    min(se.created_at) as first_scored_at
  from public.profiles p
  left join public.score_events se on se.user_id = p.id
  group by p.id, p.full_name, p.department, p.avatar_url, p.employee_code
),
pending_codes as (
  select
    null::uuid as id,
    coalesce(w.full_name, max(e.employee_code)) as full_name,
    w.department,
    null::text as avatar_url,
    e.employee_code,
    sum(e.points)::integer as total_score,
    min(e.created_at) as first_scored_at
  from public.employee_score_events e
  left join public.employee_whitelist w
    on upper(w.employee_code) = upper(e.employee_code)
  where e.transferred_to is null
    and not exists (
      select 1 from public.profiles p
      where p.employee_code is not null
        and upper(p.employee_code) = upper(e.employee_code)
    )
  group by e.employee_code, w.full_name, w.department
),
combined as (
  select * from registered where total_score > 0
  union all
  select * from pending_codes
)
select
  id,
  full_name,
  department,
  avatar_url,
  employee_code,
  total_score,
  first_scored_at,
  rank() over (
    order by
      total_score desc,
      first_scored_at asc nulls last,
      full_name asc
  ) as rank
from combined
where total_score > 0;

grant select on public.leaderboard to anon, authenticated;
