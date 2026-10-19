-- =============================================================================
-- Bước 4 – Báo tin từ đoàn viên (tin vui / tin buồn / tin ốm / tin khác)
-- + nền tảng dùng chung cho các phiếu sau này (đề nghị thăm hỏi, thanh toán…):
--   số phiếu tự động theo năm, tệp đính kèm riêng tư, lịch sử chỉ ghi thêm.
-- - Mọi truy cập đi qua API máy chủ (service role): RLS bật, không mở policy cho
--   anon/authenticated. Đoàn viên chỉ xem tin của mình (kiểm tra ở API).
-- - Chuyển trạng thái chỉ qua hàm cdilv_life_event_transition (ghi lịch sử cùng giao dịch).
-- Chạy: node scripts/apply-life-events.mjs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Số phiếu: <TIỀN TỐ>-<NĂM>-<4 số>, tăng dần theo năm, không trùng
-- -----------------------------------------------------------------------------
create table if not exists public.cdilv_number_sequences (
  prefix text not null,
  year integer not null,
  last_value integer not null default 0,
  primary key (prefix, year)
);

create or replace function public.cdilv_next_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))::integer;
  v_value integer;
begin
  insert into public.cdilv_number_sequences (prefix, year, last_value)
  values (p_prefix, v_year, 1)
  on conflict (prefix, year)
  do update set last_value = public.cdilv_number_sequences.last_value + 1
  returning last_value into v_value;

  return p_prefix || '-' || v_year || '-' || lpad(v_value::text, 4, '0');
end;
$$;

-- -----------------------------------------------------------------------------
-- Người có quyền (admin luôn có) – dùng để gửi thông báo cho đúng người
-- -----------------------------------------------------------------------------
create or replace function public.cdilv_users_with_permission(p_code text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.cdilv_profiles p
  where p.approval_status = 'approved'
    and (
      p.role = 'admin'
      or exists (
        select 1
        from public.cdilv_user_roles ur
        join public.cdilv_role_permissions rp on rp.role_id = ur.role_id
        where ur.user_id = p.id and rp.permission_code = p_code
      )
    );
$$;

-- -----------------------------------------------------------------------------
-- Tin báo
-- -----------------------------------------------------------------------------
create table if not exists public.cdilv_life_events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  member_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  category text not null check (category in ('happy', 'sad', 'sick', 'other')),
  -- Loại sự việc và quan hệ: danh mục khai báo trong code (src/lib/life-events/registry.ts)
  event_type text not null check (char_length(event_type) between 1 and 40),
  subject_relation text not null check (char_length(subject_relation) between 1 and 40),
  subject_name text check (subject_name is null or char_length(subject_name) <= 120),
  event_date date not null,
  location text check (location is null or char_length(location) <= 300),
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'submitted'
    check (status in ('submitted', 'acknowledged', 'withdrawn')),
  handled_by uuid references public.cdilv_profiles(id) on delete set null,
  handled_at timestamptz,
  handler_note text check (handler_note is null or char_length(handler_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cdilv_life_events_member_idx
  on public.cdilv_life_events (member_id, created_at desc);
create index if not exists cdilv_life_events_status_idx
  on public.cdilv_life_events (status, created_at desc);

create table if not exists public.cdilv_life_event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.cdilv_life_events(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) <= 200),
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  uploaded_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cdilv_life_event_attachments_event_idx
  on public.cdilv_life_event_attachments (event_id, created_at);

create table if not exists public.cdilv_life_event_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.cdilv_life_events(id) on delete cascade,
  actor_id uuid references public.cdilv_profiles(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists cdilv_life_event_logs_event_idx
  on public.cdilv_life_event_logs (event_id, created_at);

-- Lịch sử chỉ ghi thêm. Ngoại lệ: khóa ngoại tự đặt actor_id = null khi tài khoản bị xóa.
create or replace function public.cdilv_guard_life_event_logs()
returns trigger
language plpgsql
as $$
begin
  if new.event_id = old.event_id
     and new.action = old.action
     and new.from_status is not distinct from old.from_status
     and new.to_status is not distinct from old.to_status
     and new.note is not distinct from old.note
     and new.created_at = old.created_at
     and new.actor_id is null then
    return new;
  end if;
  raise exception 'Lịch sử tin báo chỉ được ghi thêm, không được sửa.';
end;
$$;

drop trigger if exists trg_cdilv_life_event_logs_immutable on public.cdilv_life_event_logs;
create trigger trg_cdilv_life_event_logs_immutable
  before update on public.cdilv_life_event_logs
  for each row execute function public.cdilv_guard_life_event_logs();

-- Tạo tin: tự cấp số phiếu BT-YYYY-NNNN
create or replace function public.cdilv_trg_life_event_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.code := public.cdilv_next_number('BT');
  new.status := 'submitted';
  new.handled_by := null;
  new.handled_at := null;
  new.handler_note := null;
  return new;
end;
$$;

drop trigger if exists trg_cdilv_life_event_before_insert on public.cdilv_life_events;
create trigger trg_cdilv_life_event_before_insert
  before insert on public.cdilv_life_events
  for each row execute function public.cdilv_trg_life_event_before_insert();

-- Tạo tin: ghi lịch sử + báo cho người có quyền xem tin báo
create or replace function public.cdilv_trg_life_event_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member text;
  v_kind text;
begin
  insert into public.cdilv_life_event_logs (event_id, actor_id, action, to_status)
  values (new.id, new.member_id, 'created', 'submitted');

  select coalesce(nullif(trim(full_name), ''), 'Một đoàn viên') into v_member
  from public.cdilv_profiles where id = new.member_id;

  v_kind := case new.category
    when 'happy' then 'tin vui 🎉'
    when 'sad' then 'tin buồn 🕯️'
    when 'sick' then 'tin ốm 🏥'
    else 'tin'
  end;

  insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
  select
    uid,
    'life_event_new',
    coalesce(v_member, 'Một đoàn viên') || ' báo ' || v_kind,
    'Phiếu ' || new.code || ' đang chờ tiếp nhận.',
    '/life-events/' || new.id,
    new.member_id
  from public.cdilv_users_with_permission('life_events.view') as uid
  where uid <> new.member_id;

  return new;
end;
$$;

drop trigger if exists trg_cdilv_life_event_after_insert on public.cdilv_life_events;
create trigger trg_cdilv_life_event_after_insert
  after insert on public.cdilv_life_events
  for each row execute function public.cdilv_trg_life_event_after_insert();

-- -----------------------------------------------------------------------------
-- Chuyển trạng thái (kiểm tra quyền ở API; ở đây kiểm tra thứ tự hợp lệ)
--   submitted → acknowledged  (người tiếp nhận)
--   submitted → withdrawn     (chính người báo rút lại)
-- -----------------------------------------------------------------------------
create or replace function public.cdilv_life_event_transition(
  p_event_id uuid,
  p_actor_id uuid,
  p_to_status text,
  p_note text default null
)
returns public.cdilv_life_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.cdilv_life_events;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into v_event from public.cdilv_life_events where id = p_event_id for update;
  if not found then
    raise exception 'Không tìm thấy tin báo.' using errcode = 'P0002';
  end if;

  if v_event.status <> 'submitted' or p_to_status not in ('acknowledged', 'withdrawn') then
    raise exception 'Không thể chuyển tin báo từ trạng thái "%" sang "%".', v_event.status, p_to_status
      using errcode = 'P0001';
  end if;

  if p_to_status = 'withdrawn' and p_actor_id <> v_event.member_id then
    raise exception 'Chỉ người báo tin mới rút lại được.' using errcode = 'P0001';
  end if;

  update public.cdilv_life_events
  set status = p_to_status,
      handled_by = case when p_to_status = 'acknowledged' then p_actor_id else handled_by end,
      handled_at = case when p_to_status = 'acknowledged' then now() else handled_at end,
      handler_note = case when p_to_status = 'acknowledged' then v_note else handler_note end,
      updated_at = now()
  where id = p_event_id
  returning * into v_event;

  insert into public.cdilv_life_event_logs (event_id, actor_id, action, from_status, to_status, note)
  values (p_event_id, p_actor_id, p_to_status, 'submitted', p_to_status, v_note);

  if p_to_status = 'acknowledged' and p_actor_id <> v_event.member_id then
    insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
    values (
      v_event.member_id,
      'life_event_ack',
      'Công đoàn đã tiếp nhận tin báo của bạn',
      'Phiếu ' || v_event.code || coalesce(' – ' || v_note, ''),
      '/life-events/' || v_event.id,
      p_actor_id
    );
  end if;

  return v_event;
end;
$$;

-- Ghi chú thêm / bổ sung tệp: chỉ ghi lịch sử
create or replace function public.cdilv_life_event_log(
  p_event_id uuid,
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
  select status into v_status from public.cdilv_life_events where id = p_event_id;
  if not found then
    raise exception 'Không tìm thấy tin báo.' using errcode = 'P0002';
  end if;
  insert into public.cdilv_life_event_logs (event_id, actor_id, action, from_status, to_status, note)
  values (p_event_id, p_actor_id, p_action, v_status, v_status, nullif(trim(coalesce(p_note, '')), ''));
  update public.cdilv_life_events set updated_at = now() where id = p_event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Quyền truy cập
-- -----------------------------------------------------------------------------
alter table public.cdilv_number_sequences enable row level security;
alter table public.cdilv_life_events enable row level security;
alter table public.cdilv_life_event_attachments enable row level security;
alter table public.cdilv_life_event_logs enable row level security;

revoke all on
  public.cdilv_number_sequences,
  public.cdilv_life_events,
  public.cdilv_life_event_attachments,
  public.cdilv_life_event_logs
from anon, authenticated;

grant select, insert, update, delete on
  public.cdilv_number_sequences,
  public.cdilv_life_events,
  public.cdilv_life_event_attachments,
  public.cdilv_life_event_logs
to service_role;

revoke all on function public.cdilv_next_number(text) from public, anon, authenticated;
revoke all on function public.cdilv_users_with_permission(text) from public, anon, authenticated;
revoke all on function public.cdilv_life_event_transition(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.cdilv_life_event_log(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cdilv_next_number(text) to service_role;
grant execute on function public.cdilv_users_with_permission(text) to service_role;
grant execute on function public.cdilv_life_event_transition(uuid, uuid, text, text) to service_role;
grant execute on function public.cdilv_life_event_log(uuid, uuid, text, text) to service_role;

-- Kho tệp riêng tư: ảnh giấy tờ (giấy ra viện, khai sinh, báo tử…), chỉ mở qua link ký hạn ngắn
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cdilv-life-events',
  'cdilv-life-events',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
