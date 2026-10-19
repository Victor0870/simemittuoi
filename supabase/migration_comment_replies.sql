-- Phản hồi bình luận (bài viết + ảnh album): một cấp, không cộng điểm, không giới hạn số lượng.
-- parent_id luôn trỏ tới bình luận gốc; reply_to_user_id là người được trả lời trực tiếp.

alter table public.cdilv_post_comments
  add column if not exists parent_id uuid references public.cdilv_post_comments(id) on delete cascade,
  add column if not exists reply_to_user_id uuid references public.cdilv_profiles(id) on delete set null;
create index if not exists cdilv_post_comments_parent_idx on public.cdilv_post_comments(parent_id);

alter table public.cdilv_album_photo_comments
  add column if not exists parent_id uuid references public.cdilv_album_photo_comments(id) on delete cascade,
  add column if not exists reply_to_user_id uuid references public.cdilv_profiles(id) on delete set null;
create index if not exists cdilv_album_photo_comments_parent_idx on public.cdilv_album_photo_comments(parent_id);

-- Chuẩn hóa phản hồi về bình luận gốc, bắt buộc cùng bài viết / cùng ảnh.
create or replace function public.cdilv_trg_post_comment_reply_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent record;
begin
  if new.parent_id is null then
    new.reply_to_user_id := null;
    return new;
  end if;
  select post_id, parent_id, user_id into v_parent from public.cdilv_post_comments where id = new.parent_id;
  if not found or v_parent.post_id <> new.post_id then
    raise exception 'Bình luận được trả lời không tồn tại.';
  end if;
  if v_parent.parent_id is not null then
    new.parent_id := v_parent.parent_id;
  end if;
  new.reply_to_user_id := coalesce(new.reply_to_user_id, v_parent.user_id);
  return new;
end;
$$;

drop trigger if exists trg_post_comment_reply_guard on public.cdilv_post_comments;
create trigger trg_post_comment_reply_guard
  before insert on public.cdilv_post_comments
  for each row execute function public.cdilv_trg_post_comment_reply_guard();

create or replace function public.cdilv_trg_album_comment_reply_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent record;
begin
  if new.parent_id is null then
    new.reply_to_user_id := null;
    return new;
  end if;
  select photo_id, parent_id, user_id into v_parent from public.cdilv_album_photo_comments where id = new.parent_id;
  if not found or v_parent.photo_id <> new.photo_id then
    raise exception 'Bình luận được trả lời không tồn tại.';
  end if;
  if v_parent.parent_id is not null then
    new.parent_id := v_parent.parent_id;
  end if;
  new.reply_to_user_id := coalesce(new.reply_to_user_id, v_parent.user_id);
  return new;
end;
$$;

drop trigger if exists trg_album_comment_reply_guard on public.cdilv_album_photo_comments;
create trigger trg_album_comment_reply_guard
  before insert on public.cdilv_album_photo_comments
  for each row execute function public.cdilv_trg_album_comment_reply_guard();

-- Phản hồi không được cộng điểm.
create or replace function public.cdilv_award_comment_score(p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment record;
  v_post_title text;
  v_award_label text := 'post_comment_' || p_comment_id::text;
  v_comment_count integer;
begin
  select c.id, c.post_id, c.user_id, c.parent_id, p.title as post_title, pr.approval_status
  into v_comment
  from public.cdilv_post_comments c
  join public.cdilv_posts p on p.id = c.post_id
  join public.cdilv_profiles pr on pr.id = c.user_id
  where c.id = p_comment_id;

  if not found or v_comment.parent_id is not null then
    return false;
  end if;

  if v_comment.approval_status is distinct from 'approved' then
    return false;
  end if;

  if exists (select 1 from public.cdilv_score_events where award_label = v_award_label) then
    return true;
  end if;

  select count(*)::integer into v_comment_count
  from public.cdilv_score_events se
  join public.cdilv_post_comments pc on pc.id::text = substring(se.award_label from 'post_comment_(.+)')
  where se.user_id = v_comment.user_id
    and pc.post_id = v_comment.post_id;

  if v_comment_count >= 3 then
    return false;
  end if;

  v_post_title := coalesce(v_comment.post_title, 'Bài viết');
  if length(v_post_title) > 35 then
    v_post_title := substring(v_post_title from 1 for 35) || '...';
  end if;

  insert into public.cdilv_score_events (user_id, points, note, award_label)
  values (v_comment.user_id, 1, 'Thưởng bình luận bài viết: ' || v_post_title || ' (+1đ)', v_award_label);

  return true;
end;
$$;

create or replace function public.cdilv_award_album_comment_score(p_comment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_label text := 'album_comment_' || p_comment_id::text;
  v_awarded integer;
  v_title text;
begin
  select c.id, c.user_id, c.photo_id, c.parent_id, a.title, pr.approval_status
  into v
  from public.cdilv_album_photo_comments c
  join public.cdilv_album_photos ph on ph.id = c.photo_id
  join public.cdilv_albums a on a.id = ph.album_id
  join public.cdilv_profiles pr on pr.id = c.user_id
  where c.id = p_comment_id;

  if not found or v.parent_id is not null or v.approval_status is distinct from 'approved' then
    return 0;
  end if;

  if exists (select 1 from public.cdilv_score_events where award_label = v_label) then
    return 0;
  end if;

  select count(*)::integer into v_awarded
  from public.cdilv_score_events se
  where se.user_id = v.user_id
    and se.award_label in (
      select 'album_comment_' || c2.id::text
      from public.cdilv_album_photo_comments c2
      where c2.photo_id = v.photo_id and c2.user_id = v.user_id
    );

  if v_awarded >= 3 then
    return 0;
  end if;

  v_title := coalesce(v.title, 'Album ảnh');
  if length(v_title) > 35 then
    v_title := substring(v_title from 1 for 35) || '...';
  end if;

  insert into public.cdilv_score_events (user_id, points, note, award_label)
  values (v.user_id, 1, 'Thưởng bình luận ảnh album: ' || v_title || ' (+1đ)', v_label);

  return 1;
end;
$$;

-- Thông báo bình luận bài viết: bình luận gốc báo admin như cũ;
-- phản hồi chỉ báo người được trả lời và chủ bình luận gốc.
create or replace function public.cdilv_trg_notify_admin_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_name text;
  v_post_title text;
  v_short_content text;
  v_short_post text;
  v_root_author uuid;
begin
  select coalesce(nullif(trim(full_name), ''), 'Một đoàn viên')
  into v_author_name
  from public.cdilv_profiles
  where id = new.user_id;
  v_author_name := coalesce(v_author_name, 'Một đoàn viên');

  select title into v_post_title from public.cdilv_posts where id = new.post_id;
  v_short_post := coalesce(v_post_title, 'Bài viết');
  if length(v_short_post) > 40 then
    v_short_post := substring(v_short_post from 1 for 40) || '...';
  end if;

  v_short_content := regexp_replace(new.content, '\[Ảnh thiết kế Logo\]:[^\s]+', '', 'g');
  v_short_content := trim(regexp_replace(v_short_content, '\s+', ' ', 'g'));
  if v_short_content = '' or v_short_content is null then
    v_short_content := 'Đã gửi một ảnh tác phẩm đính kèm';
  elsif length(v_short_content) > 60 then
    v_short_content := substring(v_short_content from 1 for 60) || '...';
  end if;

  if new.parent_id is not null then
    select user_id into v_root_author from public.cdilv_post_comments where id = new.parent_id;

    insert into public.cdilv_notifications (user_id, type, title, message, link)
    select distinct t.uid,
      'comment_reply',
      case when t.uid = new.reply_to_user_id
        then v_author_name || ' đã trả lời bình luận của bạn 💬'
        else v_author_name || ' đã phản hồi trong bình luận của bạn 💬'
      end,
      '"' || v_short_content || '" tại bài viết "' || v_short_post || '"',
      '/posts/' || new.post_id || '#comments'
    from (values (new.reply_to_user_id), (v_root_author)) as t(uid)
    where t.uid is not null and t.uid <> new.user_id;

    return new;
  end if;

  insert into public.cdilv_notifications (user_id, type, title, message, link)
  select
    p.id,
    'new_comment',
    v_author_name || ' đã bình luận bài viết 💬',
    '"' || v_short_content || '" tại bài viết "' || v_short_post || '"',
    '/posts/' || new.post_id
  from public.cdilv_profiles p
  where p.role = 'admin'
    and p.approval_status = 'approved'
    and p.id <> new.user_id;

  return new;
end;
$$;

-- Thông báo bình luận ảnh: bình luận gốc báo chủ ảnh như cũ;
-- phản hồi chỉ báo người được trả lời và chủ bình luận gốc.
create or replace function public.cdilv_trg_notify_album_photo_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_photo record;
  v_author text;
  v_short text;
  v_root_author uuid;
begin
  select ph.user_id, ph.album_id into v_photo
  from public.cdilv_album_photos ph where ph.id = new.photo_id;
  if not found then
    return new;
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Một đoàn viên') into v_author
  from public.cdilv_profiles where id = new.user_id;
  v_author := coalesce(v_author, 'Một đoàn viên');

  v_short := regexp_replace(new.content, '\s+', ' ', 'g');
  if length(v_short) > 60 then
    v_short := substring(v_short from 1 for 60) || '...';
  end if;

  if new.parent_id is not null then
    select user_id into v_root_author from public.cdilv_album_photo_comments where id = new.parent_id;

    insert into public.cdilv_notifications (user_id, type, title, message, link)
    select distinct t.uid,
      'comment_reply',
      case when t.uid = new.reply_to_user_id
        then v_author || ' đã trả lời bình luận của bạn 💬'
        else v_author || ' đã phản hồi trong bình luận của bạn 💬'
      end,
      '"' || v_short || '"',
      '/albums/' || v_photo.album_id || '?photo=' || new.photo_id
    from (values (new.reply_to_user_id), (v_root_author)) as t(uid)
    where t.uid is not null and t.uid <> new.user_id;

    return new;
  end if;

  if v_photo.user_id = new.user_id then
    return new;
  end if;

  insert into public.cdilv_notifications (user_id, type, title, message, link)
  values (
    v_photo.user_id,
    'album_comment',
    v_author || ' đã bình luận ảnh của bạn 💬',
    '"' || v_short || '"',
    '/albums/' || v_photo.album_id || '?photo=' || new.photo_id
  );

  return new;
end;
$$;
