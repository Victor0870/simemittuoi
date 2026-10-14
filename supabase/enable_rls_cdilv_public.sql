-- Bật RLS cho các bảng CDILV đang mở hoàn toàn với khóa anon.
-- Khách chỉ được đọc dữ liệu công khai. Ghi dữ liệu đi qua service role (API server)
-- hoặc tài khoản admin đã duyệt.

-- ---------------------------------------------------------------------------
-- Posts: khách chỉ thấy bài đang active. Admin đăng nhập thấy cả bài inactive.
-- ---------------------------------------------------------------------------
alter table public.cdilv_posts enable row level security;
drop policy if exists "cdilv_posts_public_read" on public.cdilv_posts;
drop policy if exists "cdilv_posts_select" on public.cdilv_posts;
create policy "cdilv_posts_select" on public.cdilv_posts
  for select using (
    coalesce(is_active, true)
    or exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.approval_status = 'approved'
    )
  );
drop policy if exists "cdilv_posts_admin_write" on public.cdilv_posts;
create policy "cdilv_posts_admin_write" on public.cdilv_posts
  for all to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------
alter table public.cdilv_post_comments enable row level security;
drop policy if exists "cdilv_post_comments_select" on public.cdilv_post_comments;
create policy "cdilv_post_comments_select" on public.cdilv_post_comments
  for select using (true);
drop policy if exists "cdilv_post_comments_admin_write" on public.cdilv_post_comments;
create policy "cdilv_post_comments_admin_write" on public.cdilv_post_comments
  for all to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

alter table public.cdilv_comment_reactions enable row level security;
drop policy if exists "cdilv_comment_reactions_select" on public.cdilv_comment_reactions;
create policy "cdilv_comment_reactions_select" on public.cdilv_comment_reactions
  for select using (true);
drop policy if exists "cdilv_comment_reactions_admin_write" on public.cdilv_comment_reactions;
create policy "cdilv_comment_reactions_admin_write" on public.cdilv_comment_reactions
  for all to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------
alter table public.cdilv_activities enable row level security;
drop policy if exists "cdilv_activities_public_read" on public.cdilv_activities;
drop policy if exists "cdilv_activities_select" on public.cdilv_activities;
create policy "cdilv_activities_select" on public.cdilv_activities
  for select using (true);
drop policy if exists "cdilv_activities_admin_write" on public.cdilv_activities;
create policy "cdilv_activities_admin_write" on public.cdilv_activities
  for all to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

alter table public.cdilv_activity_registrations enable row level security;
drop policy if exists "cdilv_activity_registrations_select" on public.cdilv_activity_registrations;
create policy "cdilv_activity_registrations_select" on public.cdilv_activity_registrations
  for select using (true);
drop policy if exists "cdilv_activity_registrations_admin_write" on public.cdilv_activity_registrations;
create policy "cdilv_activity_registrations_admin_write" on public.cdilv_activity_registrations
  for all to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

-- Góp ý không public. API server dùng service role.
alter table public.cdilv_feedbacks enable row level security;
drop policy if exists "cdilv_feedbacks_select" on public.cdilv_feedbacks;
create policy "cdilv_feedbacks_select" on public.cdilv_feedbacks
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );
drop policy if exists "cdilv_feedbacks_admin_write" on public.cdilv_feedbacks;
create policy "cdilv_feedbacks_admin_write" on public.cdilv_feedbacks
  for all to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------
alter table public.cdilv_polls enable row level security;
drop policy if exists "cdilv_polls_public_read" on public.cdilv_polls;
drop policy if exists "cdilv_polls_select" on public.cdilv_polls;
create policy "cdilv_polls_select" on public.cdilv_polls
  for select using (true);
drop policy if exists "cdilv_polls_admin_all" on public.cdilv_polls;
drop policy if exists "cdilv_polls_admin_write" on public.cdilv_polls;
create policy "cdilv_polls_admin_write" on public.cdilv_polls
  for all to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

alter table public.cdilv_poll_options enable row level security;
drop policy if exists "cdilv_poll_options_public_read" on public.cdilv_poll_options;
drop policy if exists "cdilv_poll_options_select" on public.cdilv_poll_options;
create policy "cdilv_poll_options_select" on public.cdilv_poll_options
  for select using (true);
drop policy if exists "cdilv_poll_options_admin_all" on public.cdilv_poll_options;
drop policy if exists "cdilv_poll_options_admin_write" on public.cdilv_poll_options;
create policy "cdilv_poll_options_admin_write" on public.cdilv_poll_options
  for all to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

alter table public.cdilv_poll_option_members enable row level security;
drop policy if exists "cdilv_poll_members_public_read" on public.cdilv_poll_option_members;
drop policy if exists "cdilv_poll_option_members_select" on public.cdilv_poll_option_members;
create policy "cdilv_poll_option_members_select" on public.cdilv_poll_option_members
  for select using (true);
drop policy if exists "cdilv_poll_members_admin_all" on public.cdilv_poll_option_members;
drop policy if exists "cdilv_poll_option_members_admin_write" on public.cdilv_poll_option_members;
create policy "cdilv_poll_option_members_admin_write" on public.cdilv_poll_option_members
  for all to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

revoke insert, update, delete on
  public.cdilv_posts,
  public.cdilv_post_comments,
  public.cdilv_comment_reactions,
  public.cdilv_activities,
  public.cdilv_activity_registrations,
  public.cdilv_feedbacks,
  public.cdilv_polls,
  public.cdilv_poll_options,
  public.cdilv_poll_option_members
from anon;

grant select on
  public.cdilv_posts,
  public.cdilv_post_comments,
  public.cdilv_comment_reactions,
  public.cdilv_activities,
  public.cdilv_activity_registrations,
  public.cdilv_polls,
  public.cdilv_poll_options,
  public.cdilv_poll_option_members
to anon, authenticated;

grant select on public.cdilv_feedbacks to authenticated;

grant select, insert, update, delete on
  public.cdilv_posts,
  public.cdilv_post_comments,
  public.cdilv_comment_reactions,
  public.cdilv_activities,
  public.cdilv_activity_registrations,
  public.cdilv_feedbacks,
  public.cdilv_polls,
  public.cdilv_poll_options,
  public.cdilv_poll_option_members
to authenticated, service_role;

-- service_role bỏ qua RLS nhưng vẫn cần GRANT. Thiếu quyền này khiến API
-- tra cdilv_profiles bị lỗi và báo nhầm "Tài khoản không tồn tại".
grant select, insert, update, delete on
  public.cdilv_profiles,
  public.cdilv_score_events,
  public.cdilv_employee_whitelist,
  public.cdilv_employee_score_events,
  public.cdilv_leaderboard_cache
to service_role;

notify pgrst, 'reload schema';
