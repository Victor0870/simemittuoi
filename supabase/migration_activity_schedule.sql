-- =============================================================================
-- Hẹn giờ hiển thị hoạt động công đoàn (giống hẹn giờ đăng bài viết).
-- - is_active: Active/Inactive (mặc định true).
-- - published_at: thời điểm bắt đầu hiển thị; ở tương lai = hoạt động hẹn giờ.
-- - Khách/đoàn viên chỉ đọc được hoạt động Active đã đến giờ; admin đọc tất cả.
-- - Backfill: published_at = created_at, is_active = true → hoạt động hiện có giữ nguyên hiển thị.
-- Chạy: supabase db query --linked -f supabase/migration_activity_schedule.sql
-- =============================================================================

alter table public.cdilv_activities
  add column if not exists is_active boolean not null default true;

alter table public.cdilv_activities
  add column if not exists published_at timestamptz;

update public.cdilv_activities
set published_at = created_at
where published_at is null;

alter table public.cdilv_activities alter column published_at set default now();
alter table public.cdilv_activities alter column published_at set not null;

create index if not exists cdilv_activities_visible_idx
  on public.cdilv_activities (published_at desc)
  where is_active;

drop policy if exists "cdilv_activities_select" on public.cdilv_activities;
create policy "cdilv_activities_select" on public.cdilv_activities
  for select using (
    (is_active and published_at <= now())
    or exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.approval_status = 'approved'
    )
  );

notify pgrst, 'reload schema';
