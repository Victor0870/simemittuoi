-- Hẹn giờ đăng bài viết.
-- - Bài có published_at ở tương lai = bài hẹn giờ: khách/đoàn viên chưa thấy, chỉ người quản lý bài viết thấy.
-- - Thông báo "Bài viết mới" chỉ gửi khi bài thực sự lên (đăng ngay, bật Active, hoặc đến giờ hẹn).
-- - Bài hẹn giờ được đánh dấu notify_pending = true; hàm cdilv_publish_due_posts() gửi thông báo
--   cho các bài đã đến giờ (gọi từ API thông báo và từ pg_cron nếu project đã bật extension này).
-- Chạy: node scripts/apply-post-schedule.mjs

alter table public.cdilv_posts
  add column if not exists notify_pending boolean not null default false;

create index if not exists cdilv_posts_notify_pending_idx
  on public.cdilv_posts (published_at)
  where notify_pending;

create or replace function public.cdilv_send_new_post_notifications(
  p_post_id uuid,
  p_title text,
  p_author_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_short_title text := p_title;
begin
  if length(v_short_title) > 60 then
    v_short_title := substring(v_short_title from 1 for 60) || '...';
  end if;

  insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
  select
    p.id,
    'new_post',
    'Bài viết mới 📰',
    v_short_title,
    '/posts/' || p_post_id,
    p_author_id
  from public.cdilv_profiles p
  where p.approval_status = 'approved'
    and p.id is distinct from p_author_id;
end;
$$;

create or replace function public.cdilv_trg_notify_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_live boolean := false;
  v_is_live boolean;
begin
  if tg_op = 'UPDATE' then
    v_was_live := coalesce(old.is_active, true)
      and not old.notify_pending
      and coalesce(old.published_at, now()) <= now();
  end if;
  v_is_live := coalesce(new.is_active, true) and coalesce(new.published_at, now()) <= now();

  if not coalesce(new.is_active, true) then
    new.notify_pending := false;
  elsif not v_is_live then
    new.notify_pending := true;
  elsif not v_was_live then
    perform public.cdilv_send_new_post_notifications(new.id, new.title, new.author_id);
    new.notify_pending := false;
  end if;

  if v_was_live and not v_is_live then
    delete from public.cdilv_notifications
    where type = 'new_post' and link = '/posts/' || new.id and is_read = false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_post on public.cdilv_posts;
create trigger trg_notify_new_post
  before insert or update of is_active, published_at on public.cdilv_posts
  for each row execute function public.cdilv_trg_notify_new_post();

create or replace function public.cdilv_publish_due_posts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select id, title, author_id
    from public.cdilv_posts
    where notify_pending
      and coalesce(is_active, true)
      and published_at <= now()
    order by published_at
    for update skip locked
  loop
    update public.cdilv_posts set notify_pending = false where id = r.id;
    perform public.cdilv_send_new_post_notifications(r.id, r.title, r.author_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.cdilv_send_new_post_notifications(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.cdilv_publish_due_posts() from public, anon, authenticated;
grant execute on function public.cdilv_publish_due_posts() to service_role;

-- Khách/đoàn viên chỉ đọc được bài Active đã đến giờ đăng.
drop policy if exists "cdilv_posts_select" on public.cdilv_posts;
create policy "cdilv_posts_select" on public.cdilv_posts
  for select using (
    (coalesce(is_active, true) and published_at <= now())
    or exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.approval_status = 'approved'
    )
  );

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'cdilv_publish_due_posts') then
      perform cron.unschedule('cdilv_publish_due_posts');
    end if;
    perform cron.schedule(
      'cdilv_publish_due_posts',
      '* * * * *',
      'select public.cdilv_publish_due_posts()'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
