-- Đổi "điểm mỗi ảnh" của album thì áp dụng lại cho các ảnh đã đăng trước đó.
-- - Ảnh đã được cộng điểm: sửa về đúng mức điểm hiện tại (tăng hoặc giảm).
-- - Ảnh chưa được cộng (vd. đăng khi album chưa bật điểm): cộng bù, vẫn theo giới hạn max_photos_per_member.
-- - Album tắt điểm (upload_points = 0) hoặc tắt đăng ảnh: giữ nguyên điểm đã cộng, không thu hồi.
-- Gọi từ API sửa album (service role); chạy lại an toàn.

create or replace function public.cdilv_resync_album_photo_scores(p_album_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  r record;
  v_title text;
  v_updated integer := 0;
  v_added integer := 0;
begin
  select id, title, allow_member_upload, upload_points
  into a
  from public.cdilv_albums
  where id = p_album_id;

  if not found or not a.allow_member_upload or coalesce(a.upload_points, 0) <= 0 then
    return jsonb_build_object('updated', 0, 'added', 0);
  end if;

  v_title := coalesce(a.title, 'Album ảnh');
  if length(v_title) > 35 then
    v_title := substring(v_title from 1 for 35) || '...';
  end if;

  update public.cdilv_score_events se
  set points = a.upload_points,
      note = 'Thưởng đăng ảnh album: ' || v_title || ' (+' || a.upload_points || 'đ)'
  from public.cdilv_album_photos ph
  where ph.album_id = p_album_id
    and se.award_label = 'album_photo_' || ph.id::text
    and se.points <> a.upload_points;
  get diagnostics v_updated = row_count;

  for r in
    select ph.id
    from public.cdilv_album_photos ph
    where ph.album_id = p_album_id
      and not exists (
        select 1 from public.cdilv_score_events se
        where se.award_label = 'album_photo_' || ph.id::text
      )
    order by ph.created_at
  loop
    if public.cdilv_award_album_photo_score(r.id) > 0 then
      v_added := v_added + 1;
    end if;
  end loop;

  return jsonb_build_object('updated', v_updated, 'added', v_added);
end;
$$;

revoke all on function public.cdilv_resync_album_photo_scores(uuid) from public, anon, authenticated;
grant execute on function public.cdilv_resync_album_photo_scores(uuid) to service_role;

-- Sửa dữ liệu cũ: áp dụng mức điểm hiện tại cho mọi album
select a.id, a.title, public.cdilv_resync_album_photo_scores(a.id) as result
from public.cdilv_albums a;

notify pgrst, 'reload schema';
