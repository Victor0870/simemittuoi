-- =============================================================================
-- Bước 5 + 6 – Cài đặt biểu mẫu in & Đề nghị thăm hỏi đoàn viên
-- - cdilv_app_settings: cấu hình dùng chung (tên đơn vị, người ký, mức chi mặc định…)
-- - cdilv_visit_requests: phiếu đề nghị thăm hỏi (số TH-YYYY-NNNN), lập từ tin báo
--   hoặc lập trực tiếp; người được thăm hỏi chọn từ danh sách nhân viên (kể cả chưa
--   có tài khoản) và lưu bản chụp họ tên / mã NV / bộ phận để phiếu in không đổi.
-- - Trạng thái: proposed → approved → paid; proposed → rejected; proposed/approved → cancelled.
-- - Mọi truy cập qua API máy chủ (service role); quyền kiểm tra ở API.
-- =============================================================================

create table if not exists public.cdilv_app_settings (
  key text primary key check (char_length(key) between 1 and 60),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.cdilv_profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cdilv_visit_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  life_event_id uuid references public.cdilv_life_events(id) on delete set null,
  member_id uuid references public.cdilv_profiles(id) on delete set null,
  member_employee_code text not null check (char_length(member_employee_code) between 1 and 40),
  member_name text not null check (char_length(member_name) between 1 and 120),
  member_department text check (member_department is null or char_length(member_department) <= 120),
  event_type text check (event_type is null or char_length(event_type) <= 40),
  reason text not null check (char_length(reason) between 1 and 500),
  amount bigint not null check (amount > 0 and amount <= 1000000000),
  visitor_name text not null check (char_length(visitor_name) between 1 and 120),
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected', 'paid', 'cancelled')),
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  decided_by uuid references public.cdilv_profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  paid_by uuid references public.cdilv_profiles(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cdilv_visit_requests_status_idx
  on public.cdilv_visit_requests (status, created_at desc);
create index if not exists cdilv_visit_requests_event_idx
  on public.cdilv_visit_requests (life_event_id);
create index if not exists cdilv_visit_requests_member_idx
  on public.cdilv_visit_requests (member_employee_code);

create table if not exists public.cdilv_visit_request_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.cdilv_visit_requests(id) on delete cascade,
  actor_id uuid references public.cdilv_profiles(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists cdilv_visit_request_logs_request_idx
  on public.cdilv_visit_request_logs (request_id, created_at);

-- Lịch sử chỉ ghi thêm. Ngoại lệ: khóa ngoại tự đặt actor_id = null khi tài khoản bị xóa.
create or replace function public.cdilv_guard_visit_request_logs()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.request_id = old.request_id
     and new.action = old.action
     and new.from_status is not distinct from old.from_status
     and new.to_status is not distinct from old.to_status
     and new.note is not distinct from old.note
     and new.created_at = old.created_at
     and new.actor_id is null then
    return new;
  end if;
  raise exception 'Lịch sử phiếu thăm hỏi chỉ được ghi thêm, không được sửa.';
end;
$$;

drop trigger if exists trg_cdilv_visit_request_logs_immutable on public.cdilv_visit_request_logs;
create trigger trg_cdilv_visit_request_logs_immutable
  before update on public.cdilv_visit_request_logs
  for each row execute function public.cdilv_guard_visit_request_logs();

create or replace function public.cdilv_trg_visit_request_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.code := public.cdilv_next_number('TH');
  new.status := 'proposed';
  new.decided_by := null;
  new.decided_at := null;
  new.decision_note := null;
  new.paid_by := null;
  new.paid_at := null;
  return new;
end;
$$;

drop trigger if exists trg_cdilv_visit_request_before_insert on public.cdilv_visit_requests;
create trigger trg_cdilv_visit_request_before_insert
  before insert on public.cdilv_visit_requests
  for each row execute function public.cdilv_trg_visit_request_before_insert();

-- Lập phiếu: ghi lịch sử + báo cho người có quyền duyệt
create or replace function public.cdilv_trg_visit_request_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cdilv_visit_request_logs (request_id, actor_id, action, to_status)
  values (new.id, new.created_by, 'created', 'proposed');

  insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
  select
    uid,
    'visit_new',
    'Đề nghị thăm hỏi ' || new.member_name,
    'Phiếu ' || new.code || ' – ' || to_char(new.amount, 'FM999G999G999G999') || 'đ đang chờ duyệt.',
    '/office/visits/' || new.id,
    new.created_by
  from public.cdilv_users_with_permission('visits.approve') as uid
  where uid is distinct from new.created_by;

  return new;
end;
$$;

drop trigger if exists trg_cdilv_visit_request_after_insert on public.cdilv_visit_requests;
create trigger trg_cdilv_visit_request_after_insert
  after insert on public.cdilv_visit_requests
  for each row execute function public.cdilv_trg_visit_request_after_insert();

-- Chuyển trạng thái (quyền kiểm tra ở API; ở đây kiểm tra thứ tự hợp lệ)
create or replace function public.cdilv_visit_request_transition(
  p_request_id uuid,
  p_actor_id uuid,
  p_to_status text,
  p_note text default null
)
returns public.cdilv_visit_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.cdilv_visit_requests;
  v_from text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into v_req from public.cdilv_visit_requests where id = p_request_id for update;
  if not found then
    raise exception 'Không tìm thấy phiếu đề nghị.' using errcode = 'P0002';
  end if;
  v_from := v_req.status;

  if not (
    (v_from = 'proposed' and p_to_status in ('approved', 'rejected', 'cancelled'))
    or (v_from = 'approved' and p_to_status in ('paid', 'cancelled'))
  ) then
    raise exception 'Không thể chuyển phiếu từ trạng thái "%" sang "%".', v_from, p_to_status
      using errcode = 'P0001';
  end if;

  update public.cdilv_visit_requests
  set status = p_to_status,
      decided_by = case when p_to_status in ('approved', 'rejected') then p_actor_id else decided_by end,
      decided_at = case when p_to_status in ('approved', 'rejected') then now() else decided_at end,
      decision_note = case when p_to_status in ('approved', 'rejected') then v_note else decision_note end,
      paid_by = case when p_to_status = 'paid' then p_actor_id else paid_by end,
      paid_at = case when p_to_status = 'paid' then now() else paid_at end,
      updated_at = now()
  where id = p_request_id
  returning * into v_req;

  insert into public.cdilv_visit_request_logs (request_id, actor_id, action, from_status, to_status, note)
  values (p_request_id, p_actor_id, p_to_status, v_from, p_to_status, v_note);

  if p_to_status in ('approved', 'rejected', 'paid')
     and v_req.created_by is not null
     and v_req.created_by <> p_actor_id then
    insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
    values (
      v_req.created_by,
      'visit_decided',
      case p_to_status
        when 'approved' then 'Đề nghị thăm hỏi đã được duyệt'
        when 'rejected' then 'Đề nghị thăm hỏi bị từ chối'
        else 'Đề nghị thăm hỏi đã chi tiền'
      end,
      'Phiếu ' || v_req.code || ' – ' || v_req.member_name || coalesce(' – ' || v_note, ''),
      '/office/visits/' || v_req.id,
      p_actor_id
    );
  end if;

  return v_req;
end;
$$;

-- Sửa phiếu / ghi chú: chỉ ghi lịch sử
create or replace function public.cdilv_visit_request_log(
  p_request_id uuid,
  p_actor_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.cdilv_visit_requests where id = p_request_id;
  if not found then
    raise exception 'Không tìm thấy phiếu đề nghị.' using errcode = 'P0002';
  end if;
  insert into public.cdilv_visit_request_logs (request_id, actor_id, action, from_status, to_status, note)
  values (p_request_id, p_actor_id, p_action, v_status, v_status, nullif(trim(coalesce(p_note, '')), ''));
  update public.cdilv_visit_requests set updated_at = now() where id = p_request_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Quyền truy cập: chỉ service role
-- -----------------------------------------------------------------------------
alter table public.cdilv_app_settings enable row level security;
alter table public.cdilv_visit_requests enable row level security;
alter table public.cdilv_visit_request_logs enable row level security;

revoke all on
  public.cdilv_app_settings,
  public.cdilv_visit_requests,
  public.cdilv_visit_request_logs
from anon, authenticated;

grant select, insert, update, delete on
  public.cdilv_app_settings,
  public.cdilv_visit_requests,
  public.cdilv_visit_request_logs
to service_role;

revoke all on function public.cdilv_guard_visit_request_logs() from public, anon, authenticated;
revoke all on function public.cdilv_trg_visit_request_before_insert() from public, anon, authenticated;
revoke all on function public.cdilv_trg_visit_request_after_insert() from public, anon, authenticated;
revoke all on function public.cdilv_visit_request_transition(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.cdilv_visit_request_log(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cdilv_visit_request_transition(uuid, uuid, text, text) to service_role;
grant execute on function public.cdilv_visit_request_log(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
