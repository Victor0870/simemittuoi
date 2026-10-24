-- Bảng xếp hạng thi đua: tính lại thứ hạng tối đa 15 phút/lần thay vì sau MỖI lần cộng điểm.
--
-- Trước: trigger statement-level trên cdilv_score_events / cdilv_employee_score_events gọi
-- cdilv_refresh_leaderboard_cache() sau mỗi câu lệnh → TRUNCATE cdilv_leaderboard_cache (khoá ACCESS EXCLUSIVE,
-- chặn mọi lượt đọc bảng xếp hạng) + ghi lại toàn bộ cdilv_profiles. Khi đang bình chọn (mỗi phiếu có thưởng
-- là 1 lần cộng điểm) việc này khoá DB và làm trang tải chậm vài giây.
--
-- Sau:
--   1. Điểm tổng (cdilv_profiles.total_score) của ĐÚNG người vừa đổi điểm được tính lại ngay trong giao dịch
--      → mỗi người luôn thấy điểm của mình đúng. Thứ hạng (rank) giữ nguyên tới lần tính lại kế tiếp.
--   2. Mỗi thay đổi chỉ ghi 1 dòng đánh dấu vào cdilv_leaderboard_dirty (không khoá bảng xếp hạng).
--   3. cdilv_refresh_leaderboard_if_stale(p_max_age_seconds) tính lại toàn bộ (vẫn bằng
--      cdilv_refresh_leaderboard_cache() hiện có) khi có đánh dấu VÀ lần tính trước đã quá p_max_age_seconds giây.
--      Ứng dụng gọi với 900 (15 phút) khi cache bảng xếp hạng hết hạn; thao tác admin chốt / thu hồi điểm gọi với 0.
--
-- CHƯA CHẠY TỰ ĐỘNG: chạy thủ công 1 lần trong Supabase SQL Editor. Chạy lại nhiều lần vẫn an toàn.
-- Hoàn tác: chạy lại khối tạo trigger cdilv_score_events_refresh_leaderboard /
-- cdilv_employee_score_events_refresh_leaderboard trong cdilv_on_shared_project.sql và xoá 4 trigger mới bên dưới.

begin;

create index if not exists cdilv_score_events_user_id_idx
  on public.cdilv_score_events (user_id);

create table if not exists public.cdilv_leaderboard_dirty (
  id bigserial primary key,
  created_at timestamptz not null default now()
);

alter table public.cdilv_leaderboard_dirty enable row level security;
revoke all on public.cdilv_leaderboard_dirty from anon, authenticated;

-- Tính lại điểm tổng của các tài khoản vừa đổi điểm (cùng quy tắc với cdilv_refresh_leaderboard_cache:
-- tổng > 0 thì giữ tổng, ngược lại 0 và bỏ hạng).
create or replace function public.cdilv_sync_profile_totals(p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    return;
  end if;

  -- Khoá hồ sơ theo thứ tự id: 2 giao dịch cùng cộng điểm cho 1 người chờ nhau (không deadlock),
  -- câu UPDATE bên dưới chạy với snapshot mới nên thấy cả điểm giao dịch kia vừa ghi.
  perform 1
  from public.cdilv_profiles
  where id = any (p_user_ids)
  order by id
  for update;

  update public.cdilv_profiles p
  set
    total_score = greatest(s.total, 0),
    rank = case when s.total > 0 then p.rank else null end
  from (
    select
      u.id,
      coalesce(
        (select sum(se.points) from public.cdilv_score_events se where se.user_id = u.id),
        0
      )::integer as total
    from unnest(p_user_ids) as u(id)
  ) s
  where p.id = s.id
    and (
      p.total_score is distinct from greatest(s.total, 0)
      or (s.total <= 0 and p.rank is not null)
    );
end;
$$;

create or replace function public.cdilv_trg_score_events_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct user_id) into v_ids from new_rows where user_id is not null;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct user_id) into v_ids from old_rows where user_id is not null;
  else
    select array_agg(distinct user_id) into v_ids
    from (select user_id from new_rows union select user_id from old_rows) t
    where user_id is not null;
  end if;

  perform public.cdilv_sync_profile_totals(v_ids);
  insert into public.cdilv_leaderboard_dirty default values;
  return null;
end;
$$;

create or replace function public.cdilv_trg_mark_leaderboard_dirty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cdilv_leaderboard_dirty default values;
  return null;
end;
$$;

-- Tính lại toàn bộ bảng xếp hạng nếu có thay đổi và lần tính trước đã quá p_max_age_seconds giây.
-- Trả về true nếu đã tính lại.
create or replace function public.cdilv_refresh_leaderboard_if_stale(p_max_age_seconds integer default 900)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_id bigint;
  v_last timestamptz;
begin
  -- Mỗi lúc chỉ 1 phiên tính lại; phiên khác bỏ qua và tiếp tục đọc dữ liệu cũ.
  if not pg_try_advisory_xact_lock(hashtext('cdilv_refresh_leaderboard_if_stale')) then
    return false;
  end if;

  select max(id) into v_max_id from public.cdilv_leaderboard_dirty;
  if v_max_id is null then
    return false;
  end if;

  select max(updated_at) into v_last from public.cdilv_leaderboard_cache;
  if v_last is not null
     and v_last > now() - make_interval(secs => greatest(coalesce(p_max_age_seconds, 900), 0)) then
    return false;
  end if;

  perform public.cdilv_refresh_leaderboard_cache();
  -- Chỉ xoá các đánh dấu đã thấy; thay đổi đến trong lúc tính sẽ được tính ở lần sau.
  delete from public.cdilv_leaderboard_dirty where id <= v_max_id;
  return true;
end;
$$;

drop trigger if exists cdilv_score_events_refresh_leaderboard on public.cdilv_score_events;
drop trigger if exists cdilv_employee_score_events_refresh_leaderboard on public.cdilv_employee_score_events;

drop trigger if exists cdilv_score_events_changed_ins on public.cdilv_score_events;
create trigger cdilv_score_events_changed_ins
  after insert on public.cdilv_score_events
  referencing new table as new_rows
  for each statement
  execute function public.cdilv_trg_score_events_changed();

drop trigger if exists cdilv_score_events_changed_upd on public.cdilv_score_events;
create trigger cdilv_score_events_changed_upd
  after update on public.cdilv_score_events
  referencing old table as old_rows new table as new_rows
  for each statement
  execute function public.cdilv_trg_score_events_changed();

drop trigger if exists cdilv_score_events_changed_del on public.cdilv_score_events;
create trigger cdilv_score_events_changed_del
  after delete on public.cdilv_score_events
  referencing old table as old_rows
  for each statement
  execute function public.cdilv_trg_score_events_changed();

drop trigger if exists cdilv_employee_score_events_mark_dirty on public.cdilv_employee_score_events;
create trigger cdilv_employee_score_events_mark_dirty
  after insert or update or delete on public.cdilv_employee_score_events
  for each statement
  execute function public.cdilv_trg_mark_leaderboard_dirty();

-- Hàm nội bộ: client không gọi được qua /rest/v1/rpc, chỉ service role (API của ứng dụng).
revoke execute on function public.cdilv_sync_profile_totals(uuid[]) from public, anon, authenticated;
revoke execute on function public.cdilv_trg_score_events_changed() from public, anon, authenticated;
revoke execute on function public.cdilv_trg_mark_leaderboard_dirty() from public, anon, authenticated;
revoke execute on function public.cdilv_refresh_leaderboard_if_stale(integer) from public, anon, authenticated;
grant execute on function public.cdilv_sync_profile_totals(uuid[]) to service_role;
grant execute on function public.cdilv_trg_score_events_changed() to service_role;
grant execute on function public.cdilv_trg_mark_leaderboard_dirty() to service_role;
grant execute on function public.cdilv_refresh_leaderboard_if_stale(integer) to service_role;

-- Đánh dấu để lần đọc đầu tiên sau migration tính lại ngay.
insert into public.cdilv_leaderboard_dirty default values;

commit;

-- (Tuỳ chọn) Nếu project bật pg_cron, có thể tính lại định kỳ kể cả khi không ai mở bảng xếp hạng:
-- select cron.schedule('cdilv-leaderboard-refresh', '*/15 * * * *', 'select public.cdilv_refresh_leaderboard_if_stale(840)');
