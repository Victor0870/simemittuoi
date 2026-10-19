-- Thông báo bài viết mới cho đoàn viên.
-- - Gửi khi đăng bài đang hiển thị, hoặc khi bài ẩn được bật hiển thị; không gửi cho chính người đăng.
-- - Bài bị xóa → xóa mọi thông báo trỏ tới bài đó (tránh bấm vào ra trang không tồn tại).
-- - Bài bị ẩn → xóa thông báo "Bài viết mới" chưa đọc của bài đó.
-- Chạy: node scripts/apply-post-notifications.mjs

create or replace function public.cdilv_trg_notify_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_short_title text;
begin
  if tg_op = 'UPDATE' and coalesce(old.is_active, true) and not coalesce(new.is_active, true) then
    delete from public.cdilv_notifications
    where type = 'new_post' and link = '/posts/' || new.id and is_read = false;
    return new;
  end if;

  if coalesce(new.is_active, true) and (tg_op = 'INSERT' or not coalesce(old.is_active, true)) then
    v_short_title := new.title;
    if length(v_short_title) > 60 then
      v_short_title := substring(v_short_title from 1 for 60) || '...';
    end if;

    insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
    select
      p.id,
      'new_post',
      'Bài viết mới 📰',
      v_short_title,
      '/posts/' || new.id,
      new.author_id
    from public.cdilv_profiles p
    where p.approval_status = 'approved'
      and p.id is distinct from new.author_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_post on public.cdilv_posts;
create trigger trg_notify_new_post
  after insert or update of is_active on public.cdilv_posts
  for each row execute function public.cdilv_trg_notify_new_post();

create or replace function public.cdilv_trg_cleanup_post_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cdilv_notifications where link like '/posts/' || old.id || '%';
  return old;
end;
$$;

drop trigger if exists trg_cleanup_post_notifications on public.cdilv_posts;
create trigger trg_cleanup_post_notifications
  after delete on public.cdilv_posts
  for each row execute function public.cdilv_trg_cleanup_post_notifications();

-- Dọn thông báo đang trỏ tới bài đã xóa
delete from public.cdilv_notifications n
where n.link ~ '^/posts/[0-9a-f-]{36}'
  and not exists (
    select 1 from public.cdilv_posts p where p.id::text = substring(n.link from 8 for 36)
  );
