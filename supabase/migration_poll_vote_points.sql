-- Hình thức bình chọn "Vote theo point".
-- Chương trình cũ giữ vote_mode = 'standard' (bình chọn theo phiếu như trước), không đổi dữ liệu đã có.
-- Mỗi người bầu (cá nhân hoặc cả đội chơi) có ngân sách điểm = điểm cơ bản + điểm admin cộng thêm,
-- tự chia cho một hoặc nhiều bài thi. Mọi kiểm tra ngân sách và ghi điểm chạy trong hàm
-- cdilv_poll_points_save (khóa theo từng người bầu) để gửi đồng thời không vượt ngân sách.
-- Bảng không có policy đọc công khai; chỉ API server (service role) đọc ghi.

begin;

alter table public.cdilv_polls
  add column if not exists vote_mode text not null default 'standard',
  add column if not exists points_per_voter integer not null default 10,
  add column if not exists points_per_team integer not null default 10,
  add column if not exists allow_self_vote boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cdilv_polls_vote_mode_check') then
    alter table public.cdilv_polls
      add constraint cdilv_polls_vote_mode_check check (vote_mode in ('standard', 'points'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cdilv_polls_points_budget_check') then
    alter table public.cdilv_polls
      add constraint cdilv_polls_points_budget_check check (
        points_per_voter between 0 and 100000 and points_per_team between 0 and 100000
      );
  end if;
end $$;

create table if not exists public.cdilv_poll_point_allocations (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.cdilv_polls(id) on delete cascade,
  option_id uuid not null references public.cdilv_poll_options(id) on delete cascade,
  voter_key text not null,
  voter_kind text not null check (voter_kind in ('individual', 'team')),
  team_option_id uuid references public.cdilv_poll_options(id) on delete cascade,
  is_judge boolean not null default false,
  points integer not null check (points > 0),
  employee_code text,
  user_id uuid,
  ip_address text,
  device_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poll_id, voter_key, option_id)
);

create index if not exists cdilv_poll_point_allocations_poll_idx
  on public.cdilv_poll_point_allocations (poll_id);
create index if not exists cdilv_poll_point_allocations_option_idx
  on public.cdilv_poll_point_allocations (option_id);

create table if not exists public.cdilv_poll_point_grants (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.cdilv_polls(id) on delete cascade,
  voter_key text not null,
  voter_kind text not null check (voter_kind in ('individual', 'team')),
  team_option_id uuid references public.cdilv_poll_options(id) on delete cascade,
  employee_code text,
  points integer not null check (points between 1 and 100000),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  granted_by uuid,
  granted_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_poll_point_grants_voter_idx
  on public.cdilv_poll_point_grants (poll_id, voter_key);

alter table public.cdilv_poll_point_allocations enable row level security;
alter table public.cdilv_poll_point_grants enable row level security;

revoke all on table public.cdilv_poll_point_allocations from anon, authenticated;
revoke all on table public.cdilv_poll_point_grants from anon, authenticated;
grant select, insert, update, delete on table public.cdilv_poll_point_allocations to service_role;
grant select, insert, update, delete on table public.cdilv_poll_point_grants to service_role;

-- Thay toàn bộ phân bổ điểm của một người bầu bằng p_allocations ([{optionId, points}], points = 0 là rút điểm).
-- Tổng mới không được vượt ngân sách; nếu ngân sách bị giảm sau khi đã bầu thì chỉ cho rút bớt.
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poll record;
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
  if p_voter_key is null or btrim(p_voter_key) = '' then
    return jsonb_build_object('ok', false, 'reason', 'voter_invalid');
  end if;
  if p_voter_kind is null or p_voter_kind not in ('individual', 'team') then
    return jsonb_build_object('ok', false, 'reason', 'voter_invalid');
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'allocation_invalid');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('cdilv_poll_points:' || p_poll_id::text || ':' || p_voter_key, 0)
  );

  select id, vote_mode, points_per_voter, points_per_team, allow_self_vote, status, is_active
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

  v_base := case when p_voter_kind = 'team' then v_poll.points_per_team else v_poll.points_per_voter end;
  v_base := coalesce(v_base, 0);

  select coalesce(sum(points), 0)::integer into v_granted
  from public.cdilv_poll_point_grants
  where poll_id = p_poll_id and voter_key = p_voter_key;

  v_budget := v_base + v_granted;

  select coalesce(sum(points), 0)::integer into v_old_total
  from public.cdilv_poll_point_allocations
  where poll_id = p_poll_id and voter_key = p_voter_key;

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
      on o.id = k::uuid and o.poll_id = p_poll_id and o.is_active is distinct from false
    where o.id is null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'option_invalid');
  end if;

  if not coalesce(v_poll.allow_self_vote, false) and exists (
    select 1 from jsonb_object_keys(v_new) k
    where k::uuid = any(coalesce(p_blocked_option_ids, '{}'::uuid[]))
  ) then
    return jsonb_build_object('ok', false, 'reason', 'self_vote_blocked');
  end if;

  select coalesce(sum(value::integer), 0)::integer into v_new_total from jsonb_each_text(v_new);

  if v_new_total > v_budget and exists (
    select 1
    from jsonb_each_text(v_new) e
    left join public.cdilv_poll_point_allocations a
      on a.poll_id = p_poll_id and a.voter_key = p_voter_key and a.option_id = e.key::uuid
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
    where poll_id = p_poll_id and voter_key = p_voter_key
    union
    select k::uuid from jsonb_object_keys(v_new) k
  ) s;

  delete from public.cdilv_poll_point_allocations
  where poll_id = p_poll_id
    and voter_key = p_voter_key
    and not (v_new ? option_id::text);

  insert into public.cdilv_poll_point_allocations as a (
    poll_id, option_id, voter_key, voter_kind, team_option_id, is_judge, points,
    employee_code, user_id, ip_address, device_fingerprint
  )
  select
    p_poll_id, e.key::uuid, p_voter_key, p_voter_kind, p_team_option_id, coalesce(p_is_judge, false),
    e.value::integer, p_employee_code, p_user_id, p_ip_address, p_device_fingerprint
  from jsonb_each_text(v_new) e
  on conflict (poll_id, voter_key, option_id) do update set
    points = excluded.points,
    voter_kind = excluded.voter_kind,
    team_option_id = excluded.team_option_id,
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
    'budget', v_budget,
    'base', v_base,
    'granted', v_granted,
    'used', v_new_total,
    'previousUsed', v_old_total,
    'remaining', greatest(v_budget - v_new_total, 0)
  );
end;
$$;

revoke all on function public.cdilv_poll_points_save(uuid, text, text, uuid, boolean, text, uuid, text, text, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.cdilv_poll_points_save(uuid, text, text, uuid, boolean, text, uuid, text, text, uuid[], jsonb) to service_role;

commit;

notify pgrst, 'reload schema';
