-- Album ảnh CDILV: chỉ thành viên đã duyệt được xem; Admin tạo album và cài đặt quyền đăng ảnh.
-- Chạy trên project dùng chung (BizMate) — node scripts/apply-photo-albums.mjs

create table if not exists public.cdilv_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_url text,
  allow_member_upload boolean not null default false,
  max_photos_per_member integer not null default 5
    check (max_photos_per_member between 1 and 100),
  upload_points integer not null default 0
    check (upload_points between 0 and 100),
  is_active boolean not null default true,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cdilv_albums_created_idx
  on public.cdilv_albums (created_at desc);

create table if not exists public.cdilv_album_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.cdilv_albums(id) on delete cascade,
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  image_url text not null,
  storage_path text,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_album_photos_album_idx
  on public.cdilv_album_photos (album_id, created_at desc);

create index if not exists cdilv_album_photos_album_user_idx
  on public.cdilv_album_photos (album_id, user_id);

create table if not exists public.cdilv_album_photo_reactions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.cdilv_album_photos(id) on delete cascade,
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('like', 'heart', 'haha')),
  created_at timestamptz not null default now(),
  unique (photo_id, user_id)
);

create index if not exists cdilv_album_photo_reactions_photo_idx
  on public.cdilv_album_photo_reactions (photo_id);

create table if not exists public.cdilv_album_photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.cdilv_album_photos(id) on delete cascade,
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_album_photo_comments_photo_idx
  on public.cdilv_album_photo_comments (photo_id, created_at);

create index if not exists cdilv_album_photo_comments_photo_user_idx
  on public.cdilv_album_photo_comments (photo_id, user_id);

-- ---------------------------------------------------------------------------
-- Quyền truy cập: chỉ thành viên đã duyệt đọc trực tiếp; ghi đi qua API (service role).
-- ---------------------------------------------------------------------------
create or replace function public.cdilv_is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cdilv_profiles p
    where p.id = auth.uid() and p.approval_status = 'approved'
  );
$$;

grant execute on function public.cdilv_is_approved_member() to authenticated;

alter table public.cdilv_albums enable row level security;
alter table public.cdilv_album_photos enable row level security;
alter table public.cdilv_album_photo_reactions enable row level security;
alter table public.cdilv_album_photo_comments enable row level security;

drop policy if exists "cdilv_albums_member_read" on public.cdilv_albums;
create policy "cdilv_albums_member_read" on public.cdilv_albums
  for select to authenticated using (public.cdilv_is_approved_member());

drop policy if exists "cdilv_album_photos_member_read" on public.cdilv_album_photos;
create policy "cdilv_album_photos_member_read" on public.cdilv_album_photos
  for select to authenticated using (public.cdilv_is_approved_member());

drop policy if exists "cdilv_album_photo_reactions_member_read" on public.cdilv_album_photo_reactions;
create policy "cdilv_album_photo_reactions_member_read" on public.cdilv_album_photo_reactions
  for select to authenticated using (public.cdilv_is_approved_member());

drop policy if exists "cdilv_album_photo_comments_member_read" on public.cdilv_album_photo_comments;
create policy "cdilv_album_photo_comments_member_read" on public.cdilv_album_photo_comments
  for select to authenticated using (public.cdilv_is_approved_member());

revoke all on public.cdilv_albums, public.cdilv_album_photos,
  public.cdilv_album_photo_reactions, public.cdilv_album_photo_comments from anon;
grant select on public.cdilv_albums, public.cdilv_album_photos,
  public.cdilv_album_photo_reactions, public.cdilv_album_photo_comments to authenticated;
grant all on public.cdilv_albums, public.cdilv_album_photos,
  public.cdilv_album_photo_reactions, public.cdilv_album_photo_comments to service_role;

-- ---------------------------------------------------------------------------
-- Cộng điểm: đăng ảnh (theo cài đặt album) và bình luận ảnh (+1đ, tối đa 3/ảnh)
-- ---------------------------------------------------------------------------
create or replace function public.cdilv_award_album_photo_score(p_photo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_label text := 'album_photo_' || p_photo_id::text;
  v_awarded integer;
  v_title text;
begin
  select ph.id, ph.user_id, ph.album_id, a.title, a.allow_member_upload,
         a.upload_points, a.max_photos_per_member, pr.approval_status
  into v
  from public.cdilv_album_photos ph
  join public.cdilv_albums a on a.id = ph.album_id
  join public.cdilv_profiles pr on pr.id = ph.user_id
  where ph.id = p_photo_id;

  if not found
     or v.approval_status is distinct from 'approved'
     or not v.allow_member_upload
     or coalesce(v.upload_points, 0) <= 0 then
    return 0;
  end if;

  if exists (select 1 from public.cdilv_score_events where award_label = v_label) then
    return 0;
  end if;

  -- Chỉ cộng điểm cho tối đa max_photos_per_member ảnh của mỗi người trong album
  select count(*)::integer into v_awarded
  from public.cdilv_score_events se
  where se.user_id = v.user_id
    and se.award_label in (
      select 'album_photo_' || ph2.id::text
      from public.cdilv_album_photos ph2
      where ph2.album_id = v.album_id and ph2.user_id = v.user_id
    );

  if v_awarded >= v.max_photos_per_member then
    return 0;
  end if;

  v_title := coalesce(v.title, 'Album ảnh');
  if length(v_title) > 35 then
    v_title := substring(v_title from 1 for 35) || '...';
  end if;

  insert into public.cdilv_score_events (user_id, points, note, award_label)
  values (
    v.user_id,
    v.upload_points,
    'Thưởng đăng ảnh album: ' || v_title || ' (+' || v.upload_points || 'đ)',
    v_label
  );

  return v.upload_points;
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
  select c.id, c.user_id, c.photo_id, a.title, pr.approval_status
  into v
  from public.cdilv_album_photo_comments c
  join public.cdilv_album_photos ph on ph.id = c.photo_id
  join public.cdilv_albums a on a.id = ph.album_id
  join public.cdilv_profiles pr on pr.id = c.user_id
  where c.id = p_comment_id;

  if not found or v.approval_status is distinct from 'approved' then
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
  values (
    v.user_id,
    1,
    'Thưởng bình luận ảnh album: ' || v_title || ' (+1đ)',
    v_label
  );

  return 1;
end;
$$;

revoke all on function public.cdilv_award_album_photo_score(uuid) from public, anon, authenticated;
revoke all on function public.cdilv_award_album_comment_score(uuid) from public, anon, authenticated;
grant execute on function public.cdilv_award_album_photo_score(uuid) to service_role;
grant execute on function public.cdilv_award_album_comment_score(uuid) to service_role;

-- Xóa ảnh / bình luận (kể cả xóa dây chuyền khi xóa album) thì thu hồi điểm đã cộng
create or replace function public.cdilv_trg_revoke_album_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'cdilv_album_photos' then
    delete from public.cdilv_score_events where award_label = 'album_photo_' || old.id::text;
  else
    delete from public.cdilv_score_events where award_label = 'album_comment_' || old.id::text;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_revoke_album_photo_score on public.cdilv_album_photos;
create trigger trg_revoke_album_photo_score
  after delete on public.cdilv_album_photos
  for each row execute function public.cdilv_trg_revoke_album_score();

drop trigger if exists trg_revoke_album_comment_score on public.cdilv_album_photo_comments;
create trigger trg_revoke_album_comment_score
  after delete on public.cdilv_album_photo_comments
  for each row execute function public.cdilv_trg_revoke_album_score();

-- ---------------------------------------------------------------------------
-- Thông báo: album mới, bình luận / cảm xúc trên ảnh của mình
-- ---------------------------------------------------------------------------
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
  after insert on public.cdilv_albums
  for each row execute function public.cdilv_trg_notify_new_album();

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
begin
  select ph.user_id, ph.album_id into v_photo
  from public.cdilv_album_photos ph where ph.id = new.photo_id;

  if not found or v_photo.user_id = new.user_id then
    return new;
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Một đoàn viên') into v_author
  from public.cdilv_profiles where id = new.user_id;

  v_short := regexp_replace(new.content, '\s+', ' ', 'g');
  if length(v_short) > 60 then
    v_short := substring(v_short from 1 for 60) || '...';
  end if;

  insert into public.cdilv_notifications (user_id, type, title, message, link)
  values (
    v_photo.user_id,
    'album_comment',
    coalesce(v_author, 'Một đoàn viên') || ' đã bình luận ảnh của bạn 💬',
    '"' || v_short || '"',
    '/albums/' || v_photo.album_id || '?photo=' || new.photo_id
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_album_photo_comment on public.cdilv_album_photo_comments;
create trigger trg_notify_album_photo_comment
  after insert on public.cdilv_album_photo_comments
  for each row execute function public.cdilv_trg_notify_album_photo_comment();

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

  insert into public.cdilv_notifications (user_id, type, title, message, link)
  values (
    v_photo.user_id,
    'photo_reaction',
    coalesce(v_reactor, 'Một đoàn viên') || ' đã ' || v_label,
    'Đã bày tỏ cảm xúc về ảnh bạn đăng trong album.',
    '/albums/' || v_photo.album_id || '?photo=' || new.photo_id
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_album_photo_reaction on public.cdilv_album_photo_reactions;
create trigger trg_notify_album_photo_reaction
  after insert on public.cdilv_album_photo_reactions
  for each row execute function public.cdilv_trg_notify_album_photo_reaction();

-- ---------------------------------------------------------------------------
-- Storage: bucket ảnh album (upload qua API bằng service role)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cdilv-albums',
  'cdilv-albums',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
