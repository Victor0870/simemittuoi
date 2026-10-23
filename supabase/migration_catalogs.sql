-- =============================================================================
-- Quản lý danh mục
-- - Danh mục đối tượng (công ty, cá nhân… nhận / nộp tiền): mã số, tên, địa chỉ, MST, số TK, ngân hàng.
--   Mã số để trống thì tự cấp DT0001, DT0002… Không xóa – chỉ ngừng dùng (giữ liên kết chứng từ cũ).
-- - Đề nghị thanh toán liên kết với đối tượng (counterparty_id) để lập danh sách chuyển khoản.
-- - Quyền mới catalogs.manage: cấp sẵn cho các cấp đang có finance.manage (trước đây sửa danh mục thu – chi).
-- - Mọi truy cập qua API máy chủ (service role); quyền kiểm tra ở API.
-- =============================================================================

create sequence if not exists public.cdilv_counterparty_code_seq;

create table if not exists public.cdilv_counterparties (
  id uuid primary key default gen_random_uuid(),
  code text not null check (char_length(code) between 1 and 20),
  kind text not null default 'organization' check (kind in ('organization', 'individual')),
  name text not null check (char_length(name) between 1 and 200),
  address text check (address is null or char_length(address) <= 300),
  tax_code text check (tax_code is null or char_length(tax_code) <= 20),
  bank_account_no text check (bank_account_no is null or char_length(bank_account_no) <= 40),
  bank_name text check (bank_name is null or char_length(bank_name) <= 120),
  is_active boolean not null default true,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  updated_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cdilv_counterparties_code_key on public.cdilv_counterparties (upper(code));
create index if not exists cdilv_counterparties_name_idx on public.cdilv_counterparties (name);

create or replace function public.cdilv_trg_counterparty_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  if tg_op = 'INSERT' and coalesce(trim(new.code), '') = '' then
    loop
      v_code := 'DT' || lpad(nextval('public.cdilv_counterparty_code_seq')::text, 4, '0');
      exit when not exists (select 1 from public.cdilv_counterparties where upper(code) = v_code);
    end loop;
    new.code := v_code;
  end if;
  new.code := upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists trg_cdilv_counterparty_before_write on public.cdilv_counterparties;
create trigger trg_cdilv_counterparty_before_write
  before insert or update on public.cdilv_counterparties
  for each row execute function public.cdilv_trg_counterparty_before_write();

create or replace function public.cdilv_guard_counterparty_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Không xóa đối tượng – hãy bỏ chọn "Đang sử dụng" để ẩn.';
end;
$$;

drop trigger if exists trg_cdilv_counterparty_no_delete on public.cdilv_counterparties;
create trigger trg_cdilv_counterparty_no_delete
  before delete on public.cdilv_counterparties
  for each row execute function public.cdilv_guard_counterparty_delete();

alter table public.cdilv_payment_requests
  add column if not exists counterparty_id uuid references public.cdilv_counterparties(id);
create index if not exists cdilv_payment_requests_counterparty_idx
  on public.cdilv_payment_requests (counterparty_id);

-- Lưu đề nghị: thêm counterparty_id (giữ nguyên chữ ký hàm).
-- p_header: {request_date, title, requester_name, requester_department, payment_method,
--            receiver_name, receiver_account, receiver_bank, counterparty_id, note}
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
      receiver_name, receiver_account, receiver_bank, counterparty_id, note, total_amount, advanced_amount, created_by
    ) values (
      (p_header->>'request_date')::date,
      p_header->>'title',
      p_header->>'requester_name',
      nullif(p_header->>'requester_department', ''),
      coalesce(p_header->>'payment_method', 'transfer'),
      nullif(p_header->>'receiver_name', ''),
      nullif(p_header->>'receiver_account', ''),
      nullif(p_header->>'receiver_bank', ''),
      nullif(p_header->>'counterparty_id', '')::uuid,
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
        counterparty_id = nullif(p_header->>'counterparty_id', '')::uuid,
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

insert into public.cdilv_role_permissions (role_id, permission_code)
select role_id, 'catalogs.manage'
from public.cdilv_role_permissions
where permission_code = 'finance.manage'
on conflict do nothing;

alter table public.cdilv_counterparties enable row level security;
revoke all on public.cdilv_counterparties from anon, authenticated;
grant select, insert, update on public.cdilv_counterparties to service_role;
revoke all on sequence public.cdilv_counterparty_code_seq from anon, authenticated;
grant usage on sequence public.cdilv_counterparty_code_seq to service_role;

revoke all on function public.cdilv_trg_counterparty_before_write() from public, anon, authenticated;
revoke all on function public.cdilv_guard_counterparty_delete() from public, anon, authenticated;
revoke all on function public.cdilv_payment_request_save(uuid, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.cdilv_payment_request_save(uuid, uuid, jsonb, jsonb, text) to service_role;
