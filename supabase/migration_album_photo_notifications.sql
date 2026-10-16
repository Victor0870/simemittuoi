-- Thông báo gộp cho ảnh mới trong album:
-- mỗi thành viên chỉ có 1 thông báo CHƯA ĐỌC cho mỗi album, số ảnh mới được cộng dồn;
-- đã đọc thì ảnh tiếp theo tạo thông báo mới đếm lại từ 1.
-- Chạy: node scripts/apply-album-photo-notifications.mjs

alter table public.cdilv_notifications
  add column if not exists item_count integer not null default 0;

create unique index if not exists cdilv_notifications_album_photos_unread_uidx
  on public.cdilv_notifications (user_id, link)
  where type = 'album_new_photos' and is_read = false;

-- Album mới: gửi khi tạo album đang hiển thị, hoặc khi album ẩn được bật hiển thị
create or replace function public.cdilv_trg_notify_new_album()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := new.title;
begin
  if not coalesce(new.is_active, true) then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.is_active, true) then
    return new;
  end if;

  if length(v_title) > 60 then
    v_title := substring(v_title from 1 for 60) || '...';
  end if;

  insert into public.cdilv_notifications (user_id, type, title, message, link)
  select
    p.id,
    'new_album',
    'Album ảnh mới 📸',
    v_title || case when new.allow_member_upload then ' — mời bạn cùng đăng ảnh!' else '' end,
    '/albums/' || new.id
  from public.cdilv_profiles p
  where p.approval_status = 'approved'
    and p.id is distinct from new.created_by;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_album on public.cdilv_albums;
create trigger trg_notify_new_album
  after insert or update of is_active on public.cdilv_albums
  for each row execute function public.cdilv_trg_notify_new_album();

-- Ảnh mới: cộng dồn số ảnh vào thông báo chưa đọc của từng thành viên
create or replace function public.cdilv_trg_notify_album_new_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_album record;
  v_title text;
  v_link text := '/albums/' || new.album_id;
begin
  select a.title, a.is_active into v_album
  from public.cdilv_albums a where a.id = new.album_id;

  if not found or not coalesce(v_album.is_active, true) then
    return new;
  end if;

  v_title := v_album.title;
  if length(v_title) > 60 then
    v_title := substring(v_title from 1 for 60) || '...';
  end if;

  -- Thành viên chưa đọc thông báo "Album ảnh mới" của album này: gộp số ảnh vào chính thông báo đó
  update public.cdilv_notifications n
  set item_count = n.item_count + 1,
      message = v_title || ' — đã có ' || (n.item_count + 1) || ' ảnh',
      created_at = now()
  where n.type = 'new_album'
    and n.link = v_link
    and n.is_read = false
    and n.user_id <> new.user_id;

  insert into public.cdilv_notifications (user_id, type, title, message, link, item_count)
  select
    p.id,
    'album_new_photos',
    'Ảnh mới trong album 📷',
    'Album "' || v_title || '" có thêm 1 ảnh mới',
    v_link,
    1
  from public.cdilv_profiles p
  where p.approval_status = 'approved'
    and p.id <> new.user_id
    and not exists (
      select 1 from public.cdilv_notifications n
      where n.user_id = p.id
        and n.type = 'new_album'
        and n.link = v_link
        and n.is_read = false
    )
  on conflict (user_id, link) where type = 'album_new_photos' and is_read = false
  do update set
    item_count = public.cdilv_notifications.item_count + 1,
    message = 'Album "' || v_title || '" có thêm '
      || (public.cdilv_notifications.item_count + 1) || ' ảnh mới',
    created_at = now();

  return new;
end;
$$;

drop trigger if exists trg_notify_album_new_photo on public.cdilv_album_photos;
create trigger trg_notify_album_new_photo
  after insert on public.cdilv_album_photos
  for each row execute function public.cdilv_trg_notify_album_new_photo();

notify pgrst, 'reload schema';
