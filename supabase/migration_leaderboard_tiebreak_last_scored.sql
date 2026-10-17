-- Cập nhật tie-break cho Bảng xếp hạng thi đua:
-- Khi bằng điểm nhau, người nào nhận điểm trước (last_scored_at sớm hơn) sẽ ưu tiên vị trí cao hơn.

alter table if exists public.cdilv_leaderboard_cache
  add column if not exists last_scored_at timestamptz;

create or replace function public.cdilv_refresh_leaderboard_cache()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate public.cdilv_leaderboard_cache;

  insert into public.cdilv_leaderboard_cache (
    subject_key, id, employee_code, full_name, department, avatar_url,
    total_score, first_scored_at, last_scored_at, rank, updated_at
  )
  with registered as (
    select
      p.id,
      p.full_name,
      p.department,
      p.avatar_url,
      p.employee_code,
      coalesce(sum(se.points), 0)::integer as total_score,
      min(se.created_at) as first_scored_at,
      max(se.created_at) as last_scored_at
    from public.cdilv_profiles p
    left join public.cdilv_score_events se on se.user_id = p.id
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
      min(e.created_at) as first_scored_at,
      max(e.created_at) as last_scored_at
    from public.cdilv_employee_score_events e
    left join public.cdilv_employee_whitelist w
      on upper(w.employee_code) = upper(e.employee_code)
    where e.transferred_to is null
      and not exists (
        select 1 from public.cdilv_profiles p
        where p.employee_code is not null
          and upper(p.employee_code) = upper(e.employee_code)
      )
    group by e.employee_code, w.full_name, w.department
  ),
  combined as (
    select * from registered where total_score > 0
    union all
    select * from pending_codes
  ),
  ranked as (
    select
      case
        when id is not null then 'u:' || id::text
        else 'e:' || upper(employee_code)
      end as subject_key,
      id,
      employee_code,
      full_name,
      department,
      avatar_url,
      total_score,
      first_scored_at,
      last_scored_at,
      row_number() over (
        order by
          total_score desc,
          last_scored_at asc nulls last,
          first_scored_at asc nulls last,
          full_name asc
      )::integer as rank
    from combined
  )
  select
    subject_key, id, employee_code, full_name, department, avatar_url,
    total_score, first_scored_at, last_scored_at, rank, now()
  from ranked;

  update public.cdilv_profiles p
  set
    total_score = coalesce(c.total_score, 0),
    rank = c.rank
  from public.cdilv_leaderboard_cache c
  where c.id = p.id;

  update public.cdilv_profiles p
  set total_score = 0, rank = null
  where not exists (
    select 1 from public.cdilv_leaderboard_cache c where c.id = p.id
  )
  and (p.total_score <> 0 or p.rank is not null);
end;
$$;

drop view if exists public.cdilv_leaderboard;
create view public.cdilv_leaderboard as
select
  id,
  full_name,
  department,
  avatar_url,
  employee_code,
  total_score,
  first_scored_at,
  last_scored_at,
  rank
from public.cdilv_leaderboard_cache
where total_score > 0;

grant select on public.cdilv_leaderboard to anon, authenticated;

-- Thực thi cập nhật lại cache ngay lập tức
select public.cdilv_refresh_leaderboard_cache();
