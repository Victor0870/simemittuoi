-- =============================================================================
-- CDILV trên project Supabase dùng chung với BizMate
-- -----------------------------------------------------------------------------
-- Cách tách giống BizMate sẵn có:
--   • POS (bizmate_app): shops, products, sales, public.profiles (POS)…
--   • Web hóa đơn (bizmate_web): invoice_*, hkd_*, inventory_*…
--   • CDILV: toàn bộ bảng/RPC/view prefix cdilv_* — KHÔNG dùng public.profiles POS
--
-- Chạy trên project BizMate (SQL Editor hoặc psql). Idempotent.
-- Sau khi chạy: trỏ NEXT_PUBLIC_SUPABASE_* của website CDILV sang project này;
-- thêm Auth redirect URLs cho cdilv.vn / localhost.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) Patch trigger BizMate (chỉ khi còn public.profiles kiểu POS: có shop_id)
--    Bỏ qua user đăng ký CDILV (metadata app=cdilv).
--    Project CDILV riêng (đã rename profiles → cdilv_profiles): bỏ qua bước này.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'shop_id'
  ) then
    execute $fn$
      create or replace function public.handle_new_user()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        if coalesce(new.raw_user_meta_data->>'app', '') = 'cdilv' then
          return new;
        end if;

        insert into public.profiles (id, email, role)
        values (new.id, new.email, 'owner')
        on conflict (id) do nothing;

        return new;
      end;
      $body$;
    $fn$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Bảng CDILV (prefix cdilv_)
-- ---------------------------------------------------------------------------
create table if not exists public.cdilv_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  department text,
  role text not null default 'user' check (role in ('user', 'admin')),
  avatar_url text,
  employee_code text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  approved_by uuid references public.cdilv_profiles(id),
  total_score integer not null default 0,
  rank integer,
  created_at timestamptz not null default now()
);

create unique index if not exists cdilv_profiles_employee_code_unique
  on public.cdilv_profiles (employee_code)
  where employee_code is not null;

create table if not exists public.cdilv_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  tag text,
  tag_tone text not null default 'primary' check (tag_tone in ('primary', 'error')),
  image_url text,
  author_id uuid references public.cdilv_profiles(id),
  published_at timestamptz not null default now()
);

create table if not exists public.cdilv_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.cdilv_posts(id) on delete cascade,
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_post_comments_post_idx
  on public.cdilv_post_comments (post_id, created_at desc);

create index if not exists cdilv_post_comments_user_post_idx
  on public.cdilv_post_comments (post_id, user_id);

create table if not exists public.cdilv_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  event_date date,
  points integer not null default 0,
  image_url text,
  image_alt text,
  is_registration_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cdilv_activity_registrations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.cdilv_activities(id) on delete cascade,
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  registered_at timestamptz not null default now(),
  unique (activity_id, user_id)
);

create index if not exists cdilv_activity_registrations_act_idx
  on public.cdilv_activity_registrations (activity_id, registered_at asc);

create index if not exists cdilv_activity_registrations_user_idx
  on public.cdilv_activity_registrations (user_id);

create table if not exists public.cdilv_score_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  activity_id uuid references public.cdilv_activities(id),
  points integer not null,
  note text,
  employee_code text,
  award_label text,
  created_by uuid references public.cdilv_profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists cdilv_score_events_user_award_unique
  on public.cdilv_score_events (user_id, award_label)
  where award_label is not null;

create table if not exists public.cdilv_employee_whitelist (
  employee_code text primary key,
  full_name text not null,
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cdilv_employee_score_events (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null,
  points integer not null,
  note text,
  award_label text,
  source text not null default 'phap_luat_2026',
  transferred_to uuid references public.cdilv_profiles(id) on delete set null,
  transferred_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_employee_score_events_code_idx
  on public.cdilv_employee_score_events (employee_code);

create index if not exists cdilv_employee_score_events_open_idx
  on public.cdilv_employee_score_events (employee_code)
  where transferred_to is null;

create table if not exists public.cdilv_leaderboard_cache (
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

create index if not exists cdilv_leaderboard_cache_rank_idx
  on public.cdilv_leaderboard_cache (rank);

create index if not exists cdilv_leaderboard_cache_id_idx
  on public.cdilv_leaderboard_cache (id)
  where id is not null;

create index if not exists cdilv_leaderboard_cache_code_idx
  on public.cdilv_leaderboard_cache (employee_code)
  where employee_code is not null;

-- ---------------------------------------------------------------------------
-- 3) RPC / functions
-- ---------------------------------------------------------------------------
create or replace function public.cdilv_transfer_employee_scores(
  p_user_id uuid,
  p_employee_code text
)
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
    from public.cdilv_employee_score_events
    where upper(employee_code) = v_code
      and transferred_to is null
  loop
    insert into public.cdilv_score_events (
      user_id, points, note, employee_code, award_label, created_at
    )
    values (
      p_user_id, r.points, r.note, r.employee_code, r.award_label, r.created_at
    );

    update public.cdilv_employee_score_events
    set transferred_to = p_user_id,
        transferred_at = now()
    where id = r.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

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
      min(e.created_at) as first_scored_at
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

create or replace function public.cdilv_trg_refresh_leaderboard_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cdilv_refresh_leaderboard_cache();
  return null;
end;
$$;

drop trigger if exists cdilv_score_events_refresh_leaderboard on public.cdilv_score_events;
create trigger cdilv_score_events_refresh_leaderboard
  after insert or update or delete on public.cdilv_score_events
  for each statement
  execute function public.cdilv_trg_refresh_leaderboard_cache();

drop trigger if exists cdilv_employee_score_events_refresh_leaderboard
  on public.cdilv_employee_score_events;
create trigger cdilv_employee_score_events_refresh_leaderboard
  after insert or update or delete on public.cdilv_employee_score_events
  for each statement
  execute function public.cdilv_trg_refresh_leaderboard_cache();

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
  rank
from public.cdilv_leaderboard_cache
where total_score > 0;

create or replace function public.cdilv_handle_new_user()
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
  -- Chỉ xử lý user CDILV
  if coalesce(new.raw_user_meta_data->>'app', '') <> 'cdilv' then
    return new;
  end if;

  v_code := nullif(trim(coalesce(new.raw_user_meta_data->>'employee_code', '')), '');
  v_name := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    split_part(new.email, '@', 1)
  );
  v_dept := nullif(trim(coalesce(new.raw_user_meta_data->>'department', '')), '');

  insert into public.cdilv_profiles (
    id, full_name, department, employee_code, role, approval_status
  )
  values (new.id, v_name, v_dept, v_code, 'user', 'pending')
  on conflict (id) do update set
    full_name = excluded.full_name,
    department = coalesce(excluded.department, public.cdilv_profiles.department),
    employee_code = coalesce(excluded.employee_code, public.cdilv_profiles.employee_code);

  if v_code is not null then
    perform public.cdilv_transfer_employee_scores(new.id, v_code);
  end if;

  insert into public.cdilv_score_events (user_id, points, note, award_label)
  values (
    new.id,
    10,
    'Thưởng đăng ký tài khoản (+10)',
    'signup_bonus'
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists cdilv_on_auth_user_created on auth.users;
create trigger cdilv_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.cdilv_handle_new_user();

create or replace function public.cdilv_validate_employee_for_signup(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_row public.cdilv_employee_whitelist%rowtype;
begin
  if v_code is null or v_code = '' then
    return json_build_object('ok', false, 'message', 'Vui lòng nhập mã nhân viên.');
  end if;

  select * into v_row
  from public.cdilv_employee_whitelist
  where upper(employee_code) = v_code and is_active = true;

  if not found then
    return json_build_object(
      'ok', false,
      'message', 'Mã nhân viên không hợp lệ hoặc chưa được cấp quyền đăng ký.'
    );
  end if;

  if exists (
    select 1 from public.cdilv_profiles
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

create or replace function public.cdilv_update_my_avatar(p_avatar_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
  v_awarded boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'message', 'Chưa đăng nhập');
  end if;

  if v_url is null then
    return jsonb_build_object('ok', false, 'message', 'Thiếu đường dẫn ảnh đại diện');
  end if;

  if length(v_url) > 2000 then
    return jsonb_build_object('ok', false, 'message', 'URL ảnh quá dài');
  end if;

  update public.cdilv_profiles
  set avatar_url = v_url
  where id = v_uid;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Không tìm thấy hồ sơ');
  end if;

  begin
    insert into public.cdilv_score_events (user_id, points, note, award_label)
    values (
      v_uid,
      10,
      'Thưởng cập nhật ảnh đại diện (+10)',
      'avatar_bonus'
    );
    v_awarded := true;
  exception
    when unique_violation then
      v_awarded := false;
  end;

  return jsonb_build_object(
    'ok', true,
    'awarded', v_awarded,
    'points', case when v_awarded then 10 else 0 end,
    'avatar_url', v_url
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------
alter table public.cdilv_profiles enable row level security;
alter table public.cdilv_posts enable row level security;
alter table public.cdilv_activities enable row level security;
alter table public.cdilv_score_events enable row level security;
alter table public.cdilv_employee_whitelist enable row level security;
alter table public.cdilv_employee_score_events enable row level security;
alter table public.cdilv_leaderboard_cache enable row level security;

drop policy if exists "cdilv_profiles_public_read" on public.cdilv_profiles;
create policy "cdilv_profiles_public_read" on public.cdilv_profiles
  for select using (true);

drop policy if exists "cdilv_posts_public_read" on public.cdilv_posts;
create policy "cdilv_posts_public_read" on public.cdilv_posts
  for select using (true);

drop policy if exists "cdilv_activities_public_read" on public.cdilv_activities;
create policy "cdilv_activities_public_read" on public.cdilv_activities
  for select using (true);

drop policy if exists "cdilv_score_events_public_read" on public.cdilv_score_events;
create policy "cdilv_score_events_public_read" on public.cdilv_score_events
  for select using (true);

drop policy if exists "cdilv_employee_scores_public_read"
  on public.cdilv_employee_score_events;
create policy "cdilv_employee_scores_public_read"
  on public.cdilv_employee_score_events for select using (true);

drop policy if exists "cdilv_leaderboard_cache_public_read"
  on public.cdilv_leaderboard_cache;
create policy "cdilv_leaderboard_cache_public_read"
  on public.cdilv_leaderboard_cache for select using (true);

drop policy if exists "cdilv_posts_admin_write" on public.cdilv_posts;
create policy "cdilv_posts_admin_write" on public.cdilv_posts for all using (
  exists (
    select 1 from public.cdilv_profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved'
  )
);

drop policy if exists "cdilv_activities_admin_write" on public.cdilv_activities;
create policy "cdilv_activities_admin_write" on public.cdilv_activities for all using (
  exists (
    select 1 from public.cdilv_profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved'
  )
);

drop policy if exists "cdilv_score_events_admin_write" on public.cdilv_score_events;
create policy "cdilv_score_events_admin_write" on public.cdilv_score_events
  for insert with check (
    exists (
      select 1 from public.cdilv_profiles
      where id = auth.uid() and role = 'admin' and approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_employee_scores_admin_write"
  on public.cdilv_employee_score_events;
create policy "cdilv_employee_scores_admin_write"
  on public.cdilv_employee_score_events for all using (
    exists (
      select 1 from public.cdilv_profiles
      where id = auth.uid() and role = 'admin' and approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_whitelist_admin_read" on public.cdilv_employee_whitelist;
create policy "cdilv_whitelist_admin_read" on public.cdilv_employee_whitelist
  for select using (
    exists (
      select 1 from public.cdilv_profiles
      where id = auth.uid() and role = 'admin' and approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_whitelist_admin_write" on public.cdilv_employee_whitelist;
create policy "cdilv_whitelist_admin_write" on public.cdilv_employee_whitelist
  for all using (
    exists (
      select 1 from public.cdilv_profiles
      where id = auth.uid() and role = 'admin' and approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_profiles_admin_update" on public.cdilv_profiles;
create policy "cdilv_profiles_admin_update" on public.cdilv_profiles
  for update using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_profiles_self_update" on public.cdilv_profiles;
create policy "cdilv_profiles_self_update" on public.cdilv_profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.cdilv_profiles where id = auth.uid())
    and approval_status = (
      select approval_status from public.cdilv_profiles where id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.cdilv_profiles to anon, authenticated;
grant update on public.cdilv_profiles to authenticated;
grant select on public.cdilv_posts to anon, authenticated;
grant select on public.cdilv_activities to anon, authenticated;
grant select on public.cdilv_score_events to anon, authenticated;
grant select on public.cdilv_employee_score_events to anon, authenticated;
grant select on public.cdilv_leaderboard_cache to anon, authenticated;
grant select on public.cdilv_leaderboard to anon, authenticated;
grant select, insert, update on public.cdilv_employee_whitelist to authenticated;
grant select on public.cdilv_employee_whitelist to anon;

grant execute on function public.cdilv_validate_employee_for_signup(text)
  to anon, authenticated;
grant execute on function public.cdilv_transfer_employee_scores(uuid, text)
  to authenticated;
grant execute on function public.cdilv_update_my_avatar(text) to authenticated;
grant execute on function public.cdilv_refresh_leaderboard_cache() to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Storage bucket riêng
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cdilv-avatars',
  'cdilv-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cdilv_avatars_public_read" on storage.objects;
create policy "cdilv_avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'cdilv-avatars');

drop policy if exists "cdilv_avatars_owner_insert" on storage.objects;
create policy "cdilv_avatars_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'cdilv-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "cdilv_avatars_owner_update" on storage.objects;
create policy "cdilv_avatars_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'cdilv-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'cdilv-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "cdilv_avatars_owner_delete" on storage.objects;
create policy "cdilv_avatars_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'cdilv-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Seed cache rỗng an toàn
select public.cdilv_refresh_leaderboard_cache();
