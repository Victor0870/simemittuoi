-- Vote theo point: ngân sách điểm theo người (dự thi / không dự thi), bỏ điểm chung theo đội.
-- Chế độ nộp bài: Admin nhập (như cũ) hoặc Người chơi nộp bài (chờ duyệt, duyệt / từ chối).
-- Chỉ thêm: bài thi đang có nhận approval_status = 'approved' nên vẫn hiển thị như cũ; không đổi dữ liệu.
-- Cột points_per_voter / points_per_team và bảng cũ giữ nguyên (không dùng nữa).

begin;

alter table public.cdilv_polls
  add column if not exists points_per_participant integer not null default 10,
  add column if not exists points_per_non_participant integer not null default 10,
  add column if not exists submission_mode text not null default 'admin',
  add column if not exists submission_deadline timestamptz;

alter table public.cdilv_poll_options
  add column if not exists approval_status text not null default 'approved',
  add column if not exists submitted_by uuid,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cdilv_polls_participation_points_check') then
    alter table public.cdilv_polls
      add constraint cdilv_polls_participation_points_check check (
        points_per_participant between 0 and 100000 and points_per_non_participant between 0 and 100000
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cdilv_polls_submission_mode_check') then
    alter table public.cdilv_polls
      add constraint cdilv_polls_submission_mode_check check (submission_mode in ('admin', 'player'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cdilv_poll_options_approval_status_check') then
    alter table public.cdilv_poll_options
      add constraint cdilv_poll_options_approval_status_check check (
        approval_status in ('pending', 'approved', 'rejected', 'withdrawn')
      );
  end if;
end $$;

create index if not exists cdilv_poll_options_poll_status_idx
  on public.cdilv_poll_options (poll_id, approval_status);
create index if not exists cdilv_poll_options_submitted_by_idx
  on public.cdilv_poll_options (submitted_by);

-- Bài chưa duyệt / bị từ chối / đã rút không đọc được qua khóa công khai; API server (service role) vẫn đọc.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'cdilv_poll_options' and policyname = 'cdilv_poll_options_approved_only'
  ) then
    create policy cdilv_poll_options_approved_only on public.cdilv_poll_options
      as restrictive
      for select
      to anon, authenticated
      using (
        approval_status = 'approved'
        or exists (
          select 1 from public.cdilv_profiles p
          where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
        )
      );
  end if;
end $$;

-- Cùng quy tắc với normalizeEmployeeCode: viết hoa, mã số ngắn hơn 4 ký tự thêm 0 đằng trước.
create or replace function public.cdilv_poll_norm_code(p_code text)
returns text
language sql
immutable
as $$
  select case
    when c is null or c = '' then null
    when c ~ '^[0-9]+$' and length(c) < 4 then lpad(c, 4, '0')
    else c
  end
  from (select upper(btrim(p_code)) as c) s;
$$;

-- Bài thi ĐÃ DUYỆT trong chương trình có tên người này trong danh sách thành viên.
create or replace function public.cdilv_poll_member_option_ids(
  p_poll_id uuid,
  p_employee_code text,
  p_user_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct o.id), '{}'::uuid[])
  from public.cdilv_poll_options o
  join public.cdilv_poll_option_members m on m.option_id = o.id
  where o.poll_id = p_poll_id
    and o.approval_status = 'approved'
    and (
      (public.cdilv_poll_norm_code(p_employee_code) is not null
        and public.cdilv_poll_norm_code(m.employee_code) = public.cdilv_poll_norm_code(p_employee_code))
      or (p_user_id is not null and m.user_id = p_user_id)
    );
$$;

-- Mỗi người đúng một ngân sách mỗi chương trình: khóa theo mã nhân viên, không có mã thì theo tài khoản.
create or replace function public.cdilv_poll_points_voter_key(p_employee_code text, p_user_id uuid)
returns text
language sql
immutable
as $$
  select case
    when public.cdilv_poll_norm_code(p_employee_code) is not null then 'emp:' || public.cdilv_poll_norm_code(p_employee_code)
    when p_user_id is not null then 'user:' || p_user_id::text
    else null
  end;
$$;

create or replace function public.cdilv_poll_points_budget(
  p_poll_id uuid,
  p_employee_code text,
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_poll record;
  v_key text := public.cdilv_poll_points_voter_key(p_employee_code, p_user_id);
  v_members uuid[];
  v_base integer;
  v_granted integer;
  v_used integer;
  v_allocations jsonb;
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'reason', 'voter_invalid');
  end if;

  select points_per_participant, points_per_non_participant, allow_self_vote into v_poll
  from public.cdilv_polls where id = p_poll_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'poll_not_found');
  end if;

  v_members := public.cdilv_poll_member_option_ids(p_poll_id, p_employee_code, p_user_id);
  v_base := case when cardinality(v_members) > 0
    then v_poll.points_per_participant else v_poll.points_per_non_participant end;

  select coalesce(sum(points), 0)::integer into v_granted
  from public.cdilv_poll_point_grants where poll_id = p_poll_id and voter_key = v_key;

  select coalesce(sum(points), 0)::integer, coalesce(jsonb_object_agg(option_id::text, points), '{}'::jsonb)
    into v_used, v_allocations
  from public.cdilv_poll_point_allocations where poll_id = p_poll_id and voter_key = v_key;

  return jsonb_build_object(
    'ok', true,
    'voterKey', v_key,
    'isParticipant', cardinality(v_members) > 0,
    'memberOptionIds', to_jsonb(v_members),
    'allowSelfVote', coalesce(v_poll.allow_self_vote, false),
    'base', coalesce(v_base, 0),
    'granted', v_granted,
    'budget', coalesce(v_base, 0) + v_granted,
    'used', v_used,
    'allocations', v_allocations
  );
end;
$$;

-- Thay toàn bộ phân bổ điểm của một người bằng p_allocations ([{optionId, points}], points = 0 là rút).
-- Ngân sách, tự vote, bài thi hợp lệ đều tính lại bên trong khóa của người bầu.
create or replace function public.cdilv_poll_points_allocate(
  p_poll_id uuid,
  p_employee_code text,
  p_user_id uuid,
  p_is_judge boolean,
  p_ip_address text,
  p_device_fingerprint text,
  p_allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := public.cdilv_poll_points_voter_key(p_employee_code, p_user_id);
  v_code text := public.cdilv_poll_norm_code(p_employee_code);
  v_poll record;
  v_members uuid[];
  v_base integer;
  v_granted integer;
  v_budget integer;
  v_old_total integer;
  v_new_total integer;
  v_item jsonb;
  v_opt uuid;
  v_pts integer;
  v_new jsonb := '{}'::jsonb;
  v_affected uuid[];
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'reason', 'voter_invalid');
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'allocation_invalid');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('cdilv_poll_points:' || p_poll_id::text || ':' || v_key, 0));

  select id, vote_mode, points_per_participant, points_per_non_participant, allow_self_vote, status, is_active
    into v_poll
  from public.cdilv_polls
  where id = p_poll_id
  for share;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'poll_not_found');
  end if;
  if v_poll.vote_mode <> 'points' then
    return jsonb_build_object('ok', false, 'reason', 'not_points_mode');
  end if;
  if v_poll.status = 'closed' or v_poll.is_active = false then
    return jsonb_build_object('ok', false, 'reason', 'poll_closed');
  end if;

  v_members := public.cdilv_poll_member_option_ids(p_poll_id, p_employee_code, p_user_id);
  v_base := coalesce(case when cardinality(v_members) > 0
    then v_poll.points_per_participant else v_poll.points_per_non_participant end, 0);

  select coalesce(sum(points), 0)::integer into v_granted
  from public.cdilv_poll_point_grants
  where poll_id = p_poll_id and voter_key = v_key;

  v_budget := v_base + v_granted;

  select coalesce(sum(points), 0)::integer into v_old_total
  from public.cdilv_poll_point_allocations
  where poll_id = p_poll_id and voter_key = v_key;

  for v_item in select value from jsonb_array_elements(p_allocations) loop
    begin
      v_opt := (v_item->>'optionId')::uuid;
      v_pts := (v_item->>'points')::integer;
    exception when others then
      return jsonb_build_object('ok', false, 'reason', 'allocation_invalid');
    end;
    if v_opt is null or v_pts is null or v_pts < 0 or v_pts > 1000000 then
      return jsonb_build_object('ok', false, 'reason', 'allocation_invalid');
    end if;
    if v_pts > 0 then
      v_new := jsonb_set(
        v_new,
        array[v_opt::text],
        to_jsonb(coalesce((v_new->>v_opt::text)::integer, 0) + v_pts)
      );
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_object_keys(v_new) k
    left join public.cdilv_poll_options o
      on o.id = k::uuid
      and o.poll_id = p_poll_id
      and o.is_active is distinct from false
      and o.approval_status = 'approved'
    where o.id is null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'option_invalid');
  end if;

  if not coalesce(v_poll.allow_self_vote, false) and exists (
    select 1 from jsonb_object_keys(v_new) k where k::uuid = any(v_members)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'self_vote_blocked');
  end if;

  select coalesce(sum(value::integer), 0)::integer into v_new_total from jsonb_each_text(v_new);

  if v_new_total > v_budget and exists (
    select 1
    from jsonb_each_text(v_new) e
    left join public.cdilv_poll_point_allocations a
      on a.poll_id = p_poll_id and a.voter_key = v_key and a.option_id = e.key::uuid
    where e.value::integer > coalesce(a.points, 0)
  ) then
    return jsonb_build_object(
      'ok', false, 'reason', 'over_budget',
      'budget', v_budget, 'base', v_base, 'granted', v_granted,
      'used', v_old_total, 'requested', v_new_total
    );
  end if;

  select coalesce(array_agg(distinct s.option_id), '{}'::uuid[]) into v_affected
  from (
    select option_id from public.cdilv_poll_point_allocations
    where poll_id = p_poll_id and voter_key = v_key
    union
    select k::uuid from jsonb_object_keys(v_new) k
  ) s;

  delete from public.cdilv_poll_point_allocations
  where poll_id = p_poll_id
    and voter_key = v_key
    and not (v_new ? option_id::text);

  insert into public.cdilv_poll_point_allocations as a (
    poll_id, option_id, voter_key, voter_kind, team_option_id, is_judge, points,
    employee_code, user_id, ip_address, device_fingerprint
  )
  select
    p_poll_id, e.key::uuid, v_key, 'individual', null, coalesce(p_is_judge, false),
    e.value::integer, v_code, p_user_id, p_ip_address, p_device_fingerprint
  from jsonb_each_text(v_new) e
  on conflict (poll_id, voter_key, option_id) do update set
    points = excluded.points,
    voter_kind = 'individual',
    team_option_id = null,
    is_judge = excluded.is_judge,
    employee_code = excluded.employee_code,
    user_id = excluded.user_id,
    ip_address = excluded.ip_address,
    device_fingerprint = excluded.device_fingerprint,
    updated_at = case when a.points <> excluded.points then now() else a.updated_at end;

  -- Khóa các bài thi theo thứ tự trước khi cộng lại, để lệnh cộng thấy phân bổ của người bầu khác vừa ghi.
  perform 1 from public.cdilv_poll_options where id = any(v_affected) order by id for update;

  update public.cdilv_poll_options o
  set vote_count = coalesce((
    select sum(a.points) from public.cdilv_poll_point_allocations a where a.option_id = o.id
  ), 0)
  where o.id = any(v_affected);

  return jsonb_build_object(
    'ok', true,
    'voterKey', v_key,
    'isParticipant', cardinality(v_members) > 0,
    'budget', v_budget,
    'base', v_base,
    'granted', v_granted,
    'used', v_new_total,
    'previousUsed', v_old_total,
    'remaining', greatest(v_budget - v_new_total, 0)
  );
end;
$$;

-- Hàm cũ (có điểm chung theo đội) không dùng nữa: giữ chữ ký nhưng không ghi gì.
create or replace function public.cdilv_poll_points_save(
  p_poll_id uuid,
  p_voter_key text,
  p_voter_kind text,
  p_team_option_id uuid,
  p_is_judge boolean,
  p_employee_code text,
  p_user_id uuid,
  p_ip_address text,
  p_device_fingerprint text,
  p_blocked_option_ids uuid[],
  p_allocations jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('ok', false, 'reason', 'replaced');
$$;

revoke all on function public.cdilv_poll_member_option_ids(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.cdilv_poll_points_budget(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.cdilv_poll_points_allocate(uuid, text, uuid, boolean, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.cdilv_poll_points_save(uuid, text, text, uuid, boolean, text, uuid, text, text, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.cdilv_poll_member_option_ids(uuid, text, uuid) to service_role;
grant execute on function public.cdilv_poll_points_budget(uuid, text, uuid) to service_role;
grant execute on function public.cdilv_poll_points_allocate(uuid, text, uuid, boolean, text, text, jsonb) to service_role;
grant execute on function public.cdilv_poll_points_save(uuid, text, text, uuid, boolean, text, uuid, text, text, uuid[], jsonb) to service_role;

commit;

notify pgrst, 'reload schema';
