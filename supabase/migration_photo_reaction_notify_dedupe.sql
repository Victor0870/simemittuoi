-- Chống spam thông báo cảm xúc ảnh: mỗi người thả cảm xúc chỉ có 1 thông báo CHƯA ĐỌC
-- cho mỗi ảnh. Gỡ rồi thả lại / đổi loại cảm xúc → cập nhật thông báo đó, không tạo thêm.
-- Chạy: node scripts/apply-photo-reaction-notify-dedupe.mjs

alter table public.cdilv_notifications
  add column if not exists actor_id uuid references public.cdilv_profiles(id) on delete set null;

create or replace function public.cdilv_trg_notify_album_photo_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_photo record;
  v_reactor text;
  v_label text;
  v_link text;
  v_title text;
begin
  select ph.user_id, ph.album_id into v_photo
  from public.cdilv_album_photos ph where ph.id = new.photo_id;

  if not found or v_photo.user_id = new.user_id then
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

  v_link := '/albums/' || v_photo.album_id || '?photo=' || new.photo_id;
  v_title := coalesce(v_reactor, 'Một đoàn viên') || ' đã ' || v_label;

  update public.cdilv_notifications
  set title = v_title, created_at = now()
  where user_id = v_photo.user_id
    and type = 'photo_reaction'
    and link = v_link
    and actor_id = new.user_id
    and is_read = false;

  -- Đổi loại cảm xúc khi chủ ảnh đã đọc thông báo cũ: không báo lại
  if found or tg_op = 'UPDATE' then
    return new;
  end if;

  insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
  values (
    v_photo.user_id,
    'photo_reaction',
    v_title,
    'Đã bày tỏ cảm xúc về ảnh bạn đăng trong album.',
    v_link,
    new.user_id
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_album_photo_reaction on public.cdilv_album_photo_reactions;
create trigger trg_notify_album_photo_reaction
  after insert or update of reaction_type on public.cdilv_album_photo_reactions
  for each row execute function public.cdilv_trg_notify_album_photo_reaction();

notify pgrst, 'reload schema';
