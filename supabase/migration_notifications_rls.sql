-- Bật Row-Level Security cho cdilv_notifications (Supabase cảnh báo rls_disabled_in_public).
-- Web chỉ đọc/ghi thông báo qua API máy chủ bằng service role (bỏ qua RLS);
-- các trigger tạo thông báo đều là security definer do postgres sở hữu nên không bị ảnh hưởng.

alter table public.cdilv_notifications enable row level security;

revoke all on table public.cdilv_notifications from anon;

drop policy if exists cdilv_notifications_select_own on public.cdilv_notifications;
create policy cdilv_notifications_select_own
  on public.cdilv_notifications
  for select
  to authenticated
  using (user_id = auth.uid());
