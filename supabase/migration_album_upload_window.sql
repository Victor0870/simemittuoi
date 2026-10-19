-- Giới hạn thời gian đăng ảnh cho album (null = không giới hạn phía đó).
-- Thành viên chỉ đăng được trong khoảng này (kiểm tra ở API); ảnh đăng ngoài khoảng không được cộng điểm.
-- Chạy lại an toàn.

alter table public.cdilv_albums add column if not exists upload_starts_at timestamptz;
alter table public.cdilv_albums add column if not exists upload_ends_at timestamptz;

alter table public.cdilv_albums drop constraint if exists cdilv_albums_upload_window_check;
alter table public.cdilv_albums
  add constraint cdilv_albums_upload_window_check
  check (upload_starts_at is null or upload_ends_at is null or upload_ends_at > upload_starts_at);

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
  select ph.id, ph.user_id, ph.album_id, ph.created_at, a.title, a.allow_member_upload,
         a.upload_points, a.max_photos_per_member, a.upload_starts_at, a.upload_ends_at,
         pr.approval_status
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

  -- Ảnh đăng ngoài thời gian cho phép (vd. người quản lý đăng bổ sung) không được cộng điểm
  if (v.upload_starts_at is not null and v.created_at < v.upload_starts_at)
     or (v.upload_ends_at is not null and v.created_at > v.upload_ends_at) then
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

revoke all on function public.cdilv_award_album_photo_score(uuid) from public, anon, authenticated;
grant execute on function public.cdilv_award_album_photo_score(uuid) to service_role;

notify pgrst, 'reload schema';
