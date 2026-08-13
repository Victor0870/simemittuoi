-- Thưởng: đăng ký +10, cập nhật avatar lần đầu +10

alter table public.score_events
  add column if not exists award_label text;

-- Mỗi loại thưởng chỉ một lần / user
create unique index if not exists score_events_user_award_unique
  on public.score_events (user_id, award_label)
  where award_label is not null;

-- Trigger đăng ký: tạo profile + transfer điểm seed + thưởng đăng ký
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_name text;
  v_dept text;
begin
  v_code := nullif(trim(coalesce(new.raw_user_meta_data->>'employee_code', '')), '');
  v_name := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    split_part(new.email, '@', 1)
  );
  v_dept := nullif(trim(coalesce(new.raw_user_meta_data->>'department', '')), '');

  insert into public.profiles (id, full_name, department, employee_code, role, approval_status)
  values (new.id, v_name, v_dept, v_code, 'user', 'pending')
  on conflict (id) do update set
    full_name = excluded.full_name,
    department = coalesce(excluded.department, public.profiles.department),
    employee_code = coalesce(excluded.employee_code, public.profiles.employee_code);

  if v_code is not null then
    perform public.transfer_employee_scores(new.id, v_code);
  end if;

  insert into public.score_events (user_id, points, note, award_label)
  values (
    new.id,
    10,
    'Thưởng đăng ký tài khoản (+10)',
    'signup_bonus'
  )
  on conflict do nothing;

  return new;
end;
$$;

-- Cập nhật avatar + thưởng lần đầu (+10)
create or replace function public.update_my_avatar(p_avatar_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
  v_awarded boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'message', 'Chưa đăng nhập');
  end if;

  if v_url is null then
    return jsonb_build_object('ok', false, 'message', 'Thiếu đường dẫn ảnh đại diện');
  end if;

  if length(v_url) > 2000 then
    return jsonb_build_object('ok', false, 'message', 'URL ảnh quá dài');
  end if;

  update public.profiles
  set avatar_url = v_url
  where id = v_uid;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Không tìm thấy hồ sơ');
  end if;

  begin
    insert into public.score_events (user_id, points, note, award_label)
    values (
      v_uid,
      10,
      'Thưởng cập nhật ảnh đại diện (+10)',
      'avatar_bonus'
    );
    v_awarded := true;
  exception
    when unique_violation then
      v_awarded := false;
  end;

  return jsonb_build_object(
    'ok', true,
    'awarded', v_awarded,
    'points', case when v_awarded then 10 else 0 end,
    'avatar_url', v_url
  );
end;
$$;

grant execute on function public.update_my_avatar(text) to authenticated;

-- Storage avatars (công khai đọc, user upload thư mục của mình)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
