-- =============================================================================
-- Migration: Homepage Security & RLS Hardening
-- 1. cdilv_activity_registrations: chi tiet dang ky chi danh cho chinh chu va admin.
--    Cung cap view cdilv_activity_participant_counts va ham cdilv_get_activity_participant_counts
--    de trang chu doc so luong dang ky ma khong lo user_id.
-- 2. cdilv_notifications: cho phep chu so huu cap nhat is_read.
-- 3. cdilv_profiles & cdilv_leaderboard_cache: thu hoi quyen SELECT cua anon, chi cho
--    phep authenticated da duyet hoac chinh chu doc ho so.
--    Cung cap view cdilv_leaderboard_public cho trang chu (khong chua employee_code).
-- 4. cdilv_is_approved_admin(): ham SECURITY DEFINER de cac bang cong khai (posts, activities,
--    poll options) kiem tra admin ma khong yeu cau anon quyen SELECT truc tiep len cdilv_profiles.
-- =============================================================================

begin;

-- 0. Helper security definer function for admin checks across public tables
create or replace function public.cdilv_is_approved_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select (p.role = 'admin' and p.approval_status = 'approved')
     from public.cdilv_profiles p
     where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.cdilv_is_approved_admin() to anon, authenticated;

-- Update public policies on posts, activities and poll options to avoid leaking cdilv_profiles check to anon
drop policy if exists "cdilv_posts_select" on public.cdilv_posts;
create policy "cdilv_posts_select" on public.cdilv_posts
  for select
  to public
  using (
    (coalesce(is_active, true) and published_at <= now())
    or cdilv_is_approved_admin()
  );

drop policy if exists "cdilv_activities_select" on public.cdilv_activities;
create policy "cdilv_activities_select" on public.cdilv_activities
  for select
  to public
  using (
    (is_active and published_at <= now())
    or cdilv_is_approved_admin()
  );

drop policy if exists "cdilv_poll_options_approved_only" on public.cdilv_poll_options;
create policy "cdilv_poll_options_approved_only" on public.cdilv_poll_options
  for select
  to anon, authenticated
  using (
    approval_status = 'approved'
    or cdilv_is_approved_admin()
  );

-- 1. cdilv_activity_registrations
drop policy if exists "cdilv_activity_registrations_select" on public.cdilv_activity_registrations;
create policy "cdilv_activity_registrations_select" on public.cdilv_activity_registrations
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or cdilv_is_approved_admin()
  );

drop policy if exists "cdilv_activity_registrations_user_insert" on public.cdilv_activity_registrations;
create policy "cdilv_activity_registrations_user_insert" on public.cdilv_activity_registrations
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_activity_registrations_user_delete" on public.cdilv_activity_registrations;
create policy "cdilv_activity_registrations_user_delete" on public.cdilv_activity_registrations
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.approval_status = 'approved'
    )
  );

grant select, insert, delete on public.cdilv_activity_registrations to authenticated;
revoke all on public.cdilv_activity_registrations from anon;

-- View dem so luong dang ky cong khai
create or replace view public.cdilv_activity_participant_counts
with (security_invoker = false)
as
  select
    activity_id,
    count(*)::bigint as participant_count
  from public.cdilv_activity_registrations
  group by activity_id;

grant select on public.cdilv_activity_participant_counts to anon, authenticated;

create or replace function public.cdilv_get_activity_participant_counts(p_activity_ids uuid[] default null)
returns table (activity_id uuid, participant_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select r.activity_id, count(*)::bigint as participant_count
  from public.cdilv_activity_registrations r
  where (p_activity_ids is null or r.activity_id = any(p_activity_ids))
  group by r.activity_id;
$$;

grant execute on function public.cdilv_get_activity_participant_counts(uuid[]) to anon, authenticated;

-- 2. cdilv_notifications
drop policy if exists cdilv_notifications_update_own on public.cdilv_notifications;
create policy cdilv_notifications_update_own
  on public.cdilv_notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant update (is_read) on public.cdilv_notifications to authenticated;

-- 3. cdilv_profiles & cdilv_leaderboard_cache
revoke select on public.cdilv_profiles from anon;
revoke select on public.cdilv_leaderboard_cache from anon;

drop policy if exists "cdilv_profiles_public_read" on public.cdilv_profiles;
drop policy if exists "cdilv_profiles_authenticated_read" on public.cdilv_profiles;
create policy "cdilv_profiles_authenticated_read" on public.cdilv_profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_leaderboard_cache_public_read" on public.cdilv_leaderboard_cache;
drop policy if exists "cdilv_leaderboard_cache_authenticated_read" on public.cdilv_leaderboard_cache;
create policy "cdilv_leaderboard_cache_authenticated_read" on public.cdilv_leaderboard_cache
  for select
  to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.approval_status = 'approved'
    )
  );

-- View bang xep hang cong khai an toan (khong chua employee_code)
create or replace view public.cdilv_leaderboard_public
with (security_invoker = false)
as
  select
    id,
    full_name,
    department,
    avatar_url,
    total_score,
    rank
  from public.cdilv_leaderboard_cache
  where total_score > 0;

grant select on public.cdilv_leaderboard_public to anon, authenticated;

commit;

notify pgrst, 'reload schema';
