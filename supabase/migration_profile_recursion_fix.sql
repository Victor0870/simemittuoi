-- =============================================================================
-- Migration: Fix cdilv_profiles RLS Infinite Recursion (42P17)
-- 1. Create SECURITY DEFINER function cdilv_is_approved_member() to break
--    self-referential recursion on cdilv_profiles.
-- 2. Recreate cdilv_profiles_authenticated_read using (id = auth.uid() or cdilv_is_approved_member()).
-- 3. Recreate cdilv_leaderboard_cache_authenticated_read using cdilv_is_approved_member().
-- 4. Recreate cdilv_profiles_admin_update using cdilv_is_approved_admin().
-- 5. Recreate cdilv_activity_registrations insert/delete using cdilv_is_approved_member().
-- 6. Replace subqueries in all other admin policies with cdilv_is_approved_admin().
-- =============================================================================

begin;

-- 1. Function cdilv_is_approved_member
create or replace function public.cdilv_is_approved_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.cdilv_profiles
    where id = auth.uid()
      and approval_status = 'approved'
  );
$$;

grant execute on function public.cdilv_is_approved_member() to authenticated;

-- 2. cdilv_profiles_authenticated_read
drop policy if exists "cdilv_profiles_authenticated_read" on public.cdilv_profiles;
create policy "cdilv_profiles_authenticated_read"
  on public.cdilv_profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.cdilv_is_approved_member()
  );

-- 3. cdilv_leaderboard_cache_authenticated_read
drop policy if exists "cdilv_leaderboard_cache_authenticated_read" on public.cdilv_leaderboard_cache;
create policy "cdilv_leaderboard_cache_authenticated_read"
  on public.cdilv_leaderboard_cache
  for select
  to authenticated
  using (
    public.cdilv_is_approved_member()
  );

-- 4. cdilv_profiles_admin_update
drop policy if exists "cdilv_profiles_admin_update" on public.cdilv_profiles;
create policy "cdilv_profiles_admin_update"
  on public.cdilv_profiles
  for update
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

-- 5. cdilv_activity_registrations insert & delete
drop policy if exists "cdilv_activity_registrations_user_insert" on public.cdilv_activity_registrations;
create policy "cdilv_activity_registrations_user_insert"
  on public.cdilv_activity_registrations
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.cdilv_is_approved_member()
  );

drop policy if exists "cdilv_activity_registrations_user_delete" on public.cdilv_activity_registrations;
create policy "cdilv_activity_registrations_user_delete"
  on public.cdilv_activity_registrations
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.cdilv_is_approved_member()
  );

drop policy if exists "cdilv_activity_registrations_admin_write" on public.cdilv_activity_registrations;
create policy "cdilv_activity_registrations_admin_write"
  on public.cdilv_activity_registrations
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

-- 6. Replace subqueries in all other admin policies with cdilv_is_approved_admin()
drop policy if exists "cdilv_posts_admin_write" on public.cdilv_posts;
create policy "cdilv_posts_admin_write"
  on public.cdilv_posts
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_post_comments_admin_write" on public.cdilv_post_comments;
create policy "cdilv_post_comments_admin_write"
  on public.cdilv_post_comments
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_comment_reactions_admin_write" on public.cdilv_comment_reactions;
create policy "cdilv_comment_reactions_admin_write"
  on public.cdilv_comment_reactions
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_activities_admin_write" on public.cdilv_activities;
create policy "cdilv_activities_admin_write"
  on public.cdilv_activities
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_feedbacks_select" on public.cdilv_feedbacks;
create policy "cdilv_feedbacks_select"
  on public.cdilv_feedbacks
  for select
  to authenticated
  using (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_feedbacks_admin_write" on public.cdilv_feedbacks;
create policy "cdilv_feedbacks_admin_write"
  on public.cdilv_feedbacks
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_polls_admin_write" on public.cdilv_polls;
create policy "cdilv_polls_admin_write"
  on public.cdilv_polls
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_poll_options_admin_write" on public.cdilv_poll_options;
create policy "cdilv_poll_options_admin_write"
  on public.cdilv_poll_options
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_poll_option_members_admin_write" on public.cdilv_poll_option_members;
create policy "cdilv_poll_option_members_admin_write"
  on public.cdilv_poll_option_members
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_quiz_questions_admin_read" on public.cdilv_quiz_questions;
create policy "cdilv_quiz_questions_admin_read"
  on public.cdilv_quiz_questions
  for select
  to authenticated
  using (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_quiz_attempts_admin_read" on public.cdilv_quiz_attempts;
create policy "cdilv_quiz_attempts_admin_read"
  on public.cdilv_quiz_attempts
  for select
  to authenticated
  using (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_user_roles_read" on public.cdilv_user_roles;
create policy "cdilv_user_roles_read"
  on public.cdilv_user_roles
  for select
  to authenticated
  using (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_permission_logs_admin_read" on public.cdilv_permission_logs;
create policy "cdilv_permission_logs_admin_read"
  on public.cdilv_permission_logs
  for select
  to authenticated
  using (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_employee_scores_admin_write" on public.cdilv_employee_score_events;
create policy "cdilv_employee_scores_admin_write"
  on public.cdilv_employee_score_events
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_score_events_admin_all" on public.cdilv_score_events;
create policy "cdilv_score_events_admin_all"
  on public.cdilv_score_events
  for all
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_regulation_documents_admin_select" on public.cdilv_regulation_documents;
create policy "cdilv_regulation_documents_admin_select"
  on public.cdilv_regulation_documents
  for select
  to authenticated
  using (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_regulation_documents_admin_insert" on public.cdilv_regulation_documents;
create policy "cdilv_regulation_documents_admin_insert"
  on public.cdilv_regulation_documents
  for insert
  to authenticated
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_regulation_documents_admin_update" on public.cdilv_regulation_documents;
create policy "cdilv_regulation_documents_admin_update"
  on public.cdilv_regulation_documents
  for update
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_regulation_sections_admin_select" on public.cdilv_regulation_sections;
create policy "cdilv_regulation_sections_admin_select"
  on public.cdilv_regulation_sections
  for select
  to authenticated
  using (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_regulation_sections_admin_insert" on public.cdilv_regulation_sections;
create policy "cdilv_regulation_sections_admin_insert"
  on public.cdilv_regulation_sections
  for insert
  to authenticated
  with check (public.cdilv_is_approved_admin());

drop policy if exists "cdilv_regulation_sections_admin_update" on public.cdilv_regulation_sections;
create policy "cdilv_regulation_sections_admin_update"
  on public.cdilv_regulation_sections
  for update
  to authenticated
  using (public.cdilv_is_approved_admin())
  with check (public.cdilv_is_approved_admin());

commit;

notify pgrst, 'reload schema';
