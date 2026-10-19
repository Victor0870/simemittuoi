-- Thả cảm xúc (👍 ❤️ 😆) cho bình luận / phản hồi ảnh trong album.
-- Đọc trực tiếp: thành viên đã duyệt; ghi đi qua API (service role).
-- Thông báo: mỗi người thả cảm xúc chỉ có 1 thông báo CHƯA ĐỌC cho mỗi bình luận.

create table if not exists public.cdilv_album_photo_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.cdilv_album_photo_comments(id) on delete cascade,
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('like', 'heart', 'haha')),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists cdilv_album_photo_comment_reactions_comment_idx
  on public.cdilv_album_photo_comment_reactions (comment_id);

alter table public.cdilv_album_photo_comment_reactions enable row level security;

drop policy if exists "cdilv_album_photo_comment_reactions_member_read" on public.cdilv_album_photo_comment_reactions;
create policy "cdilv_album_photo_comment_reactions_member_read" on public.cdilv_album_photo_comment_reactions
  for select to authenticated using (public.cdilv_is_approved_member());

revoke all on public.cdilv_album_photo_comment_reactions from anon;
revoke all on public.cdilv_album_photo_comment_reactions from authenticated;
grant select on public.cdilv_album_photo_comment_reactions to authenticated;
grant all on public.cdilv_album_photo_comment_reactions to service_role;

create or replace function public.cdilv_trg_notify_album_comment_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment record;
  v_reactor text;
  v_label text;
  v_short text;
  v_link text;
  v_title text;
begin
  select c.user_id, c.photo_id, c.content, ph.album_id into v_comment
  from public.cdilv_album_photo_comments c
  join public.cdilv_album_photos ph on ph.id = c.photo_id
  where c.id = new.comment_id;

  if not found or v_comment.user_id = new.user_id then
    return new;
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Một đoàn viên') into v_reactor
  from public.cdilv_profiles where id = new.user_id;

  case new.reaction_type
    when 'like' then v_label := 'thích 👍';
    when 'heart' then v_label := 'thả tim ❤️';
    when 'haha' then v_label := 'thả haha 😆';
    else v_label := 'bày tỏ cảm xúc';
  end case;

  v_short := regexp_replace(coalesce(v_comment.content, ''), '\s+', ' ', 'g');
  if length(v_short) > 40 then
    v_short := substring(v_short from 1 for 40) || '...';
  end if;

  v_link := '/albums/' || v_comment.album_id || '?photo=' || v_comment.photo_id;
  v_title := coalesce(v_reactor, 'Một đoàn viên') || ' đã ' || v_label;

  update public.cdilv_notifications
  set title = v_title, created_at = now()
  where user_id = v_comment.user_id
    and type = 'comment_reaction'
    and link = v_link
    and actor_id = new.user_id
    and is_read = false
    and message = 'Đã bày tỏ cảm xúc về bình luận ảnh: "' || v_short || '"';

  if found or tg_op = 'UPDATE' then
    return new;
  end if;

  insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
  values (
    v_comment.user_id,
    'comment_reaction',
    v_title,
    'Đã bày tỏ cảm xúc về bình luận ảnh: "' || v_short || '"',
    v_link,
    new.user_id
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_album_comment_reaction on public.cdilv_album_photo_comment_reactions;
create trigger trg_notify_album_comment_reaction
  after insert or update of reaction_type on public.cdilv_album_photo_comment_reactions
  for each row execute function public.cdilv_trg_notify_album_comment_reaction();

notify pgrst, 'reload schema';
