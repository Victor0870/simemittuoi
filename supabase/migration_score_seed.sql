-- Điểm seed theo mã NV + lịch sử + chuyển khi đăng ký + leaderboard thật

create table if not exists public.employee_score_events (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null,
  points integer not null,
  note text,
  award_label text,
  source text not null default 'phap_luat_2026',
  transferred_to uuid references public.profiles(id) on delete set null,
  transferred_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists employee_score_events_code_idx
  on public.employee_score_events (employee_code);

create index if not exists employee_score_events_open_idx
  on public.employee_score_events (employee_code)
  where transferred_to is null;

alter table public.score_events
  add column if not exists employee_code text,
  add column if not exists award_label text;

alter table public.employee_score_events enable row level security;

drop policy if exists "employee_scores_public_read" on public.employee_score_events;
create policy "employee_scores_public_read"
  on public.employee_score_events for select using (true);

drop policy if exists "employee_scores_admin_write" on public.employee_score_events;
create policy "employee_scores_admin_write"
  on public.employee_score_events for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and approval_status = 'approved'
    )
  );

grant select on public.employee_score_events to anon, authenticated;

-- Chuyển điểm seed → score_events khi có profile + mã NV
create or replace function public.transfer_employee_scores(p_user_id uuid, p_employee_code text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_employee_code));
  v_count integer := 0;
  r record;
begin
  if p_user_id is null or v_code is null or v_code = '' then
    return 0;
  end if;

  for r in
    select *
    from public.employee_score_events
    where upper(employee_code) = v_code
      and transferred_to is null
  loop
    insert into public.score_events (user_id, points, note, employee_code, award_label, created_at)
    values (p_user_id, r.points, r.note, r.employee_code, r.award_label, r.created_at);

    update public.employee_score_events
    set transferred_to = p_user_id,
        transferred_at = now()
    where id = r.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.transfer_employee_scores(uuid, text) to authenticated;

-- Cập nhật trigger đăng ký: lưu mã NV + chuyển điểm
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

  if v_code is not null then
    perform public.transfer_employee_scores(new.id, v_code);
  end if;

  return new;
end;
$$;

-- Leaderboard: đọc từ cache (tính sẵn khi điểm đổi — xem migration_leaderboard_cache.sql)
-- Nếu chưa có cache thì tạo view tính tạm; nếu đã có cache thì giữ view mỏng
do $$
begin
  if to_regclass('public.leaderboard_cache') is not null then
    drop view if exists public.leaderboard;
    execute $v$
      create view public.leaderboard as
      select
        id, full_name, department, avatar_url, employee_code,
        total_score, first_scored_at, rank
      from public.leaderboard_cache
      where total_score > 0
    $v$;
    perform public.refresh_leaderboard_cache();
  else
    drop view if exists public.leaderboard;
    execute $v$
      create view public.leaderboard as
      with registered as (
        select
          p.id, p.full_name, p.department, p.avatar_url, p.employee_code,
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
        id, full_name, department, avatar_url, employee_code,
        total_score, first_scored_at,
        rank() over (
          order by total_score desc, first_scored_at asc nulls last, full_name asc
        ) as rank
      from combined
      where total_score > 0
    $v$;
  end if;
end $$;

grant select on public.leaderboard to anon, authenticated;
