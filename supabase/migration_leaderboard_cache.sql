-- Lưu sẵn điểm + hạng (cache), cập nhật khi có điểm mới — trang chỉ đọc, không tính rank mỗi lần

create table if not exists public.leaderboard_cache (
  subject_key text primary key,
  id uuid,
  employee_code text,
  full_name text not null,
  department text,
  avatar_url text,
  total_score integer not null default 0,
  first_scored_at timestamptz,
  rank integer not null,
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_cache_rank_idx
  on public.leaderboard_cache (rank);

create index if not exists leaderboard_cache_id_idx
  on public.leaderboard_cache (id)
  where id is not null;

create index if not exists leaderboard_cache_code_idx
  on public.leaderboard_cache (employee_code)
  where employee_code is not null;

alter table public.profiles
  add column if not exists total_score integer not null default 0,
  add column if not exists rank integer;

-- Tính lại toàn bộ cache + ghi hạng vào profiles
create or replace function public.refresh_leaderboard_cache()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate public.leaderboard_cache;

  insert into public.leaderboard_cache (
    subject_key, id, employee_code, full_name, department, avatar_url,
    total_score, first_scored_at, rank, updated_at
  )
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
      rank() over (
        order by
          total_score desc,
          first_scored_at asc nulls last,
          full_name asc
      )::integer as rank
    from combined
  )
  select
    subject_key, id, employee_code, full_name, department, avatar_url,
    total_score, first_scored_at, rank, now()
  from ranked;

  -- Đồng bộ biến sẵn trên profiles (điểm/hạng của mình đọc cực nhẹ)
  update public.profiles p
  set
    total_score = coalesce(c.total_score, 0),
    rank = c.rank
  from public.leaderboard_cache c
  where c.id = p.id;

  update public.profiles p
  set total_score = 0, rank = null
  where not exists (
    select 1 from public.leaderboard_cache c where c.id = p.id
  )
  and (p.total_score <> 0 or p.rank is not null);
end;
$$;

grant execute on function public.refresh_leaderboard_cache() to authenticated;

-- Trigger: mỗi khi điểm đổi → refresh cache (statement-level cho batch)
create or replace function public.trg_refresh_leaderboard_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_leaderboard_cache();
  return null;
end;
$$;

drop trigger if exists score_events_refresh_leaderboard on public.score_events;
create trigger score_events_refresh_leaderboard
  after insert or update or delete on public.score_events
  for each statement
  execute function public.trg_refresh_leaderboard_cache();

drop trigger if exists employee_score_events_refresh_leaderboard on public.employee_score_events;
create trigger employee_score_events_refresh_leaderboard
  after insert or update or delete on public.employee_score_events
  for each statement
  execute function public.trg_refresh_leaderboard_cache();

-- View leaderboard chỉ đọc cache (không tính rank lúc query)
drop view if exists public.leaderboard;

create view public.leaderboard as
select
  id,
  full_name,
  department,
  avatar_url,
  employee_code,
  total_score,
  first_scored_at,
  rank
from public.leaderboard_cache
where total_score > 0;

grant select on public.leaderboard to anon, authenticated;
grant select on public.leaderboard_cache to anon, authenticated;

-- Seed lần đầu
select public.refresh_leaderboard_cache();
