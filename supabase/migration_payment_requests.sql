-- =============================================================================
-- Bước 8 – Giấy đề nghị thanh toán (mẫu "GIẤY ĐỀ NGHỊ THANH TOÁN / STATEMENT OF EXPENSES")
-- - Số phiếu TT-YYYY-NNNN; các dòng chi phí nhập tay hoặc gom từ phiếu thăm hỏi đã duyệt.
-- - Trạng thái: proposed → approved → paid; proposed → rejected; proposed/approved → cancelled.
-- - Khi xác nhận "đã chi": các phiếu thăm hỏi gom trong giấy (đang "Đã duyệt") tự chuyển "Đã chi".
-- - Mọi truy cập qua API máy chủ (service role); quyền kiểm tra ở API.
-- =============================================================================

create table if not exists public.cdilv_payment_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  request_date date not null,
  title text not null check (char_length(title) between 1 and 200),
  requester_name text not null check (char_length(requester_name) between 1 and 120),
  requester_department text check (requester_department is null or char_length(requester_department) <= 120),
  payment_method text not null default 'transfer' check (payment_method in ('transfer', 'cash')),
  receiver_name text check (receiver_name is null or char_length(receiver_name) <= 120),
  receiver_account text check (receiver_account is null or char_length(receiver_account) <= 40),
  receiver_bank text check (receiver_bank is null or char_length(receiver_bank) <= 120),
  total_amount bigint not null default 0 check (total_amount >= 0),
  advanced_amount bigint not null default 0 check (advanced_amount >= 0),
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

create index if not exists cdilv_payment_requests_status_idx
  on public.cdilv_payment_requests (status, created_at desc);

create table if not exists public.cdilv_payment_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.cdilv_payment_requests(id) on delete cascade,
  order_num integer not null,
  content text not null check (char_length(content) between 1 and 300),
  paid_to text check (paid_to is null or char_length(paid_to) <= 120),
  amount bigint not null check (amount > 0 and amount <= 1000000000),
  advanced bigint not null default 0 check (advanced >= 0 and advanced <= 1000000000),
  visit_request_id uuid references public.cdilv_visit_requests(id) on delete set null
);

create index if not exists cdilv_payment_request_items_request_idx
  on public.cdilv_payment_request_items (request_id, order_num);
create index if not exists cdilv_payment_request_items_visit_idx
  on public.cdilv_payment_request_items (visit_request_id);

create table if not exists public.cdilv_payment_request_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.cdilv_payment_requests(id) on delete cascade,
  actor_id uuid references public.cdilv_profiles(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists cdilv_payment_request_logs_request_idx
  on public.cdilv_payment_request_logs (request_id, created_at);

-- Lịch sử chỉ ghi thêm. Ngoại lệ: khóa ngoại tự đặt actor_id = null khi tài khoản bị xóa.
create or replace function public.cdilv_guard_payment_request_logs()
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
  raise exception 'Lịch sử đề nghị thanh toán chỉ được ghi thêm, không được sửa.';
end;
$$;

drop trigger if exists trg_cdilv_payment_request_logs_immutable on public.cdilv_payment_request_logs;
create trigger trg_cdilv_payment_request_logs_immutable
  before update on public.cdilv_payment_request_logs
  for each row execute function public.cdilv_guard_payment_request_logs();

create or replace function public.cdilv_trg_payment_request_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.code := public.cdilv_next_number('TT');
  new.status := 'proposed';
  new.decided_by := null;
  new.decided_at := null;
  new.decision_note := null;
  new.paid_by := null;
  new.paid_at := null;
  return new;
end;
$$;

drop trigger if exists trg_cdilv_payment_request_before_insert on public.cdilv_payment_requests;
create trigger trg_cdilv_payment_request_before_insert
  before insert on public.cdilv_payment_requests
  for each row execute function public.cdilv_trg_payment_request_before_insert();

-- Thông báo cho người có quyền duyệt (gọi sau khi đã ghi đủ các dòng chi phí và tổng tiền)
create or replace function public.cdilv_payment_request_submitted(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.cdilv_payment_requests;
begin
  select * into v_req from public.cdilv_payment_requests where id = p_request_id;
  if not found then
    raise exception 'Không tìm thấy đề nghị thanh toán.' using errcode = 'P0002';
  end if;

  insert into public.cdilv_payment_request_logs (request_id, actor_id, action, to_status)
  values (v_req.id, v_req.created_by, 'created', 'proposed');

  insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
  select
    uid,
    'payment_new',
    'Đề nghị thanh toán ' || v_req.code,
    v_req.title || ' – ' || to_char(v_req.total_amount, 'FM999G999G999G999') || 'đ đang chờ duyệt.',
    '/office/payments/' || v_req.id,
    v_req.created_by
  from public.cdilv_users_with_permission('payments.approve') as uid
  where uid is distinct from v_req.created_by;
end;
$$;

-- Lập mới (p_request_id null) hoặc sửa phiếu đang chờ duyệt: ghi thông tin chung + các dòng
-- trong cùng giao dịch, tự tính tổng. Dữ liệu đã kiểm tra ở API.
-- p_header: {request_date, title, requester_name, requester_department, payment_method,
--            receiver_name, receiver_account, receiver_bank, note}
-- p_items:  [{content, paid_to, amount, advanced, visit_request_id}]
create or replace function public.cdilv_payment_request_save(
  p_request_id uuid,
  p_actor_id uuid,
  p_header jsonb,
  p_items jsonb,
  p_log_note text default null
)
returns public.cdilv_payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.cdilv_payment_requests;
  v_total bigint;
  v_advanced bigint;
  v_conflict text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Đề nghị phải có ít nhất một dòng chi phí.' using errcode = 'P0001';
  end if;

  select coalesce(sum((x->>'amount')::bigint), 0), coalesce(sum(coalesce((x->>'advanced')::bigint, 0)), 0)
  into v_total, v_advanced
  from jsonb_array_elements(p_items) x;

  select v.code || ' (đã nằm trong ' || r.code || ')' into v_conflict
  from jsonb_array_elements(p_items) x
  join public.cdilv_payment_request_items i on i.visit_request_id = (x->>'visit_request_id')::uuid
  join public.cdilv_payment_requests r on r.id = i.request_id
  join public.cdilv_visit_requests v on v.id = i.visit_request_id
  where x->>'visit_request_id' is not null
    and r.status not in ('rejected', 'cancelled')
    and r.id is distinct from p_request_id
  limit 1;
  if v_conflict is not null then
    raise exception 'Phiếu thăm hỏi % rồi.', v_conflict using errcode = 'P0001';
  end if;

  if p_request_id is null then
    insert into public.cdilv_payment_requests (
      request_date, title, requester_name, requester_department, payment_method,
      receiver_name, receiver_account, receiver_bank, note, total_amount, advanced_amount, created_by
    ) values (
      (p_header->>'request_date')::date,
      p_header->>'title',
      p_header->>'requester_name',
      nullif(p_header->>'requester_department', ''),
      coalesce(p_header->>'payment_method', 'transfer'),
      nullif(p_header->>'receiver_name', ''),
      nullif(p_header->>'receiver_account', ''),
      nullif(p_header->>'receiver_bank', ''),
      nullif(p_header->>'note', ''),
      v_total,
      v_advanced,
      p_actor_id
    )
    returning * into v_req;
  else
    update public.cdilv_payment_requests
    set request_date = (p_header->>'request_date')::date,
        title = p_header->>'title',
        requester_name = p_header->>'requester_name',
        requester_department = nullif(p_header->>'requester_department', ''),
        payment_method = coalesce(p_header->>'payment_method', 'transfer'),
        receiver_name = nullif(p_header->>'receiver_name', ''),
        receiver_account = nullif(p_header->>'receiver_account', ''),
        receiver_bank = nullif(p_header->>'receiver_bank', ''),
        note = nullif(p_header->>'note', ''),
        total_amount = v_total,
        advanced_amount = v_advanced,
        updated_at = now()
    where id = p_request_id and status = 'proposed'
    returning * into v_req;
    if not found then
      raise exception 'Chỉ sửa được đề nghị đang chờ duyệt.' using errcode = 'P0001';
    end if;
    delete from public.cdilv_payment_request_items where request_id = p_request_id;
  end if;

  insert into public.cdilv_payment_request_items (request_id, order_num, content, paid_to, amount, advanced, visit_request_id)
  select
    v_req.id,
    ord::integer,
    x->>'content',
    nullif(x->>'paid_to', ''),
    (x->>'amount')::bigint,
    coalesce((x->>'advanced')::bigint, 0),
    (x->>'visit_request_id')::uuid
  from jsonb_array_elements(p_items) with ordinality as t(x, ord);

  if p_request_id is null then
    perform public.cdilv_payment_request_submitted(v_req.id);
  else
    insert into public.cdilv_payment_request_logs (request_id, actor_id, action, from_status, to_status, note)
    values (v_req.id, p_actor_id, 'edited', 'proposed', 'proposed', nullif(trim(coalesce(p_log_note, '')), ''));
  end if;

  return v_req;
end;
$$;

-- Chuyển trạng thái (quyền kiểm tra ở API; ở đây kiểm tra thứ tự hợp lệ)
create or replace function public.cdilv_payment_request_transition(
  p_request_id uuid,
  p_actor_id uuid,
  p_to_status text,
  p_note text default null
)
returns public.cdilv_payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.cdilv_payment_requests;
  v_from text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_visit uuid;
begin
  select * into v_req from public.cdilv_payment_requests where id = p_request_id for update;
  if not found then
    raise exception 'Không tìm thấy đề nghị thanh toán.' using errcode = 'P0002';
  end if;
  v_from := v_req.status;

  if not (
    (v_from = 'proposed' and p_to_status in ('approved', 'rejected', 'cancelled'))
    or (v_from = 'approved' and p_to_status in ('paid', 'cancelled'))
  ) then
    raise exception 'Không thể chuyển đề nghị từ trạng thái "%" sang "%".', v_from, p_to_status
      using errcode = 'P0001';
  end if;

  update public.cdilv_payment_requests
  set status = p_to_status,
      decided_by = case when p_to_status in ('approved', 'rejected') then p_actor_id else decided_by end,
      decided_at = case when p_to_status in ('approved', 'rejected') then now() else decided_at end,
      decision_note = case when p_to_status in ('approved', 'rejected') then v_note else decision_note end,
      paid_by = case when p_to_status = 'paid' then p_actor_id else paid_by end,
      paid_at = case when p_to_status = 'paid' then now() else paid_at end,
      updated_at = now()
  where id = p_request_id
  returning * into v_req;

  insert into public.cdilv_payment_request_logs (request_id, actor_id, action, from_status, to_status, note)
  values (p_request_id, p_actor_id, p_to_status, v_from, p_to_status, v_note);

  if p_to_status = 'paid' then
    for v_visit in
      select i.visit_request_id
      from public.cdilv_payment_request_items i
      join public.cdilv_visit_requests v on v.id = i.visit_request_id
      where i.request_id = p_request_id and v.status = 'approved'
    loop
      perform public.cdilv_visit_request_transition(
        v_visit, p_actor_id, 'paid', 'Theo đề nghị thanh toán ' || v_req.code
      );
    end loop;
  end if;

  if p_to_status in ('approved', 'rejected', 'paid')
     and v_req.created_by is not null
     and v_req.created_by <> p_actor_id then
    insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
    values (
      v_req.created_by,
      'payment_decided',
      case p_to_status
        when 'approved' then 'Đề nghị thanh toán đã được duyệt'
        when 'rejected' then 'Đề nghị thanh toán bị từ chối'
        else 'Đề nghị thanh toán đã chi tiền'
      end,
      'Phiếu ' || v_req.code || ' – ' || v_req.title || coalesce(' – ' || v_note, ''),
      '/office/payments/' || v_req.id,
      p_actor_id
    );
  end if;

  return v_req;
end;
$$;

-- Sửa phiếu / tải phiếu in: chỉ ghi lịch sử
create or replace function public.cdilv_payment_request_log(
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
  select status into v_status from public.cdilv_payment_requests where id = p_request_id;
  if not found then
    raise exception 'Không tìm thấy đề nghị thanh toán.' using errcode = 'P0002';
  end if;
  insert into public.cdilv_payment_request_logs (request_id, actor_id, action, from_status, to_status, note)
  values (p_request_id, p_actor_id, p_action, v_status, v_status, nullif(trim(coalesce(p_note, '')), ''));
  update public.cdilv_payment_requests set updated_at = now() where id = p_request_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Quyền truy cập: chỉ service role
-- -----------------------------------------------------------------------------
alter table public.cdilv_payment_requests enable row level security;
alter table public.cdilv_payment_request_items enable row level security;
alter table public.cdilv_payment_request_logs enable row level security;

revoke all on
  public.cdilv_payment_requests,
  public.cdilv_payment_request_items,
  public.cdilv_payment_request_logs
from anon, authenticated;

grant select, insert, update, delete on
  public.cdilv_payment_requests,
  public.cdilv_payment_request_items,
  public.cdilv_payment_request_logs
to service_role;

revoke all on function public.cdilv_guard_payment_request_logs() from public, anon, authenticated;
revoke all on function public.cdilv_trg_payment_request_before_insert() from public, anon, authenticated;
revoke all on function public.cdilv_payment_request_submitted(uuid) from public, anon, authenticated;
revoke all on function public.cdilv_payment_request_save(uuid, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.cdilv_payment_request_save(uuid, uuid, jsonb, jsonb, text) to service_role;
revoke all on function public.cdilv_payment_request_transition(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.cdilv_payment_request_log(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cdilv_payment_request_submitted(uuid) to service_role;
grant execute on function public.cdilv_payment_request_transition(uuid, uuid, text, text) to service_role;
grant execute on function public.cdilv_payment_request_log(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
