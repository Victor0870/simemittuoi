-- =============================================================================
-- Bước 7 – Sổ quỹ công đoàn
-- - Quỹ (tiền mặt / tiền gửi ngân hàng, thêm được tài khoản khác), số dư đầu kỳ + ngày bắt đầu.
-- - Danh mục thu / chi (admin thêm, sửa, ẩn – không cố định trong code).
-- - Bút toán: thu (PT-YYYY-NNNN), chi (PC-…), chuyển quỹ nội bộ (CK-…). Không xóa, chỉ hủy có lý do.
-- - Khóa sổ: cdilv_app_settings['fund'].lockedThrough – bút toán đến hết ngày này không thêm/sửa/hủy được.
-- - Đề nghị thanh toán chuyển "Đã chi" → tự ghi phiếu chi (số tiền = thực trả − đã tạm ứng).
-- - Mọi truy cập qua API máy chủ (service role); quyền kiểm tra ở API.
-- =============================================================================

create table if not exists public.cdilv_funds (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('cash', 'bank')),
  name text not null check (char_length(name) between 1 and 120),
  bank_account_no text check (bank_account_no is null or char_length(bank_account_no) <= 40),
  bank_name text check (bank_name is null or char_length(bank_name) <= 120),
  opening_balance bigint not null default 0 check (opening_balance >= 0 and opening_balance <= 100000000000),
  opening_date date not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cdilv_fund_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense')),
  code text check (code is null or char_length(code) <= 20),
  name text not null check (char_length(name) between 1 and 160),
  -- Danh mục hệ thống dùng khi tự ghi sổ: 'visit' (chi thăm hỏi), 'payment_default' (chi theo đề nghị khác)
  system_key text unique check (system_key is null or system_key in ('visit', 'payment_default')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cdilv_fund_entries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  entry_date date not null,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  fund_id uuid not null references public.cdilv_funds(id),
  to_fund_id uuid references public.cdilv_funds(id),
  category_id uuid references public.cdilv_fund_categories(id),
  amount bigint not null check (amount > 0 and amount <= 100000000000),
  description text not null check (char_length(description) between 1 and 300),
  counterparty text check (counterparty is null or char_length(counterparty) <= 120),
  document_no text check (document_no is null or char_length(document_no) <= 60),
  payment_request_id uuid unique references public.cdilv_payment_requests(id) on delete set null,
  status text not null default 'posted' check (status in ('posted', 'void')),
  void_reason text check (void_reason is null or char_length(void_reason) <= 500),
  voided_by uuid references public.cdilv_profiles(id) on delete set null,
  voided_at timestamptz,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  updated_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'transfer') = (to_fund_id is not null)),
  check (kind = 'transfer' or category_id is not null),
  check (to_fund_id is distinct from fund_id)
);

create index if not exists cdilv_fund_entries_date_idx on public.cdilv_fund_entries (entry_date, created_at);
create index if not exists cdilv_fund_entries_fund_idx on public.cdilv_fund_entries (fund_id);
create index if not exists cdilv_fund_entries_to_fund_idx on public.cdilv_fund_entries (to_fund_id);

create table if not exists public.cdilv_fund_entry_logs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.cdilv_fund_entries(id),
  actor_id uuid references public.cdilv_profiles(id) on delete set null,
  action text not null,
  note text,
  snapshot jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists cdilv_fund_entry_logs_entry_idx on public.cdilv_fund_entry_logs (entry_id, created_at);

-- Lịch sử chỉ ghi thêm. Ngoại lệ: khóa ngoại tự đặt actor_id = null khi tài khoản bị xóa.
create or replace function public.cdilv_guard_fund_entry_logs()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.entry_id = old.entry_id
     and new.action = old.action
     and new.note is not distinct from old.note
     and new.snapshot is not distinct from old.snapshot
     and new.created_at = old.created_at
     and new.actor_id is null then
    return new;
  end if;
  raise exception 'Lịch sử sổ quỹ chỉ được ghi thêm, không được sửa hay xóa.';
end;
$$;

drop trigger if exists trg_cdilv_fund_entry_logs_immutable on public.cdilv_fund_entry_logs;
create trigger trg_cdilv_fund_entry_logs_immutable
  before update or delete on public.cdilv_fund_entry_logs
  for each row execute function public.cdilv_guard_fund_entry_logs();

-- Ngày khóa sổ (null = chưa khóa)
create or replace function public.cdilv_fund_locked_through()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select nullif(value->>'lockedThrough', '')::date from public.cdilv_app_settings where key = 'fund';
$$;

create or replace function public.cdilv_trg_fund_entry_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.code := public.cdilv_next_number(case new.kind when 'income' then 'PT' when 'expense' then 'PC' else 'CK' end);
  new.status := 'posted';
  new.void_reason := null;
  new.voided_by := null;
  new.voided_at := null;
  return new;
end;
$$;

-- Kiểm tra khóa sổ, ngày bắt đầu quỹ, danh mục đúng loại; cấm xóa bút toán.
create or replace function public.cdilv_trg_fund_entry_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock date := public.cdilv_fund_locked_through();
  v_open date;
  v_cat_kind text;
begin
  if tg_op = 'DELETE' then
    raise exception 'Không được xóa bút toán sổ quỹ – hãy dùng chức năng Hủy bút toán.' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'void' then
      raise exception 'Bút toán % đã hủy, không sửa được.', old.code using errcode = 'P0001';
    end if;
    if new.code <> old.code or new.kind <> old.kind then
      raise exception 'Không đổi được số phiếu / loại bút toán.' using errcode = 'P0001';
    end if;
    if v_lock is not null and old.entry_date <= v_lock then
      raise exception 'Bút toán % thuộc kỳ đã khóa sổ (đến hết %).', old.code, to_char(v_lock, 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
  end if;

  if v_lock is not null and new.entry_date <= v_lock then
    raise exception 'Ngày % thuộc kỳ đã khóa sổ (đến hết %).', to_char(new.entry_date, 'DD/MM/YYYY'), to_char(v_lock, 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;

  select opening_date into v_open from public.cdilv_funds where id = new.fund_id;
  if new.entry_date < v_open then
    raise exception 'Ngày ghi sổ trước ngày bắt đầu theo dõi quỹ (%).', to_char(v_open, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  if new.to_fund_id is not null then
    select opening_date into v_open from public.cdilv_funds where id = new.to_fund_id;
    if new.entry_date < v_open then
      raise exception 'Ngày ghi sổ trước ngày bắt đầu theo dõi quỹ nhận (%).', to_char(v_open, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
  end if;

  if new.kind <> 'transfer' then
    select kind into v_cat_kind from public.cdilv_fund_categories where id = new.category_id;
    if v_cat_kind is distinct from new.kind then
      raise exception 'Danh mục không khớp loại thu / chi.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger chạy theo thứ tự tên: đánh số trước, kiểm tra sau.
drop trigger if exists trg_cdilv_fund_entry_a_number on public.cdilv_fund_entries;
create trigger trg_cdilv_fund_entry_a_number
  before insert on public.cdilv_fund_entries
  for each row execute function public.cdilv_trg_fund_entry_number();

drop trigger if exists trg_cdilv_fund_entry_b_validate on public.cdilv_fund_entries;
create trigger trg_cdilv_fund_entry_b_validate
  before insert or update or delete on public.cdilv_fund_entries
  for each row execute function public.cdilv_trg_fund_entry_validate();

-- Số dư đầu kỳ / ngày bắt đầu không đổi được khi đã khóa sổ qua ngày bắt đầu.
create or replace function public.cdilv_trg_fund_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock date := public.cdilv_fund_locked_through();
  v_first date;
begin
  if tg_op = 'DELETE' then
    raise exception 'Không xóa được quỹ – hãy ngừng sử dụng (ẩn) quỹ.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if v_lock is not null and new.opening_date <= v_lock and new.opening_balance <> 0 then
      raise exception 'Đã khóa sổ đến hết % – quỹ mới có số dư đầu kỳ phải bắt đầu sau ngày đó.', to_char(v_lock, 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE'
     and (new.opening_balance <> old.opening_balance or new.opening_date <> old.opening_date) then
    if v_lock is not null and least(old.opening_date, new.opening_date) <= v_lock then
      raise exception 'Đã khóa sổ đến hết % nên không đổi được số dư đầu kỳ của quỹ.', to_char(v_lock, 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
    select min(entry_date) into v_first
    from public.cdilv_fund_entries
    where status = 'posted' and (fund_id = new.id or to_fund_id = new.id);
    if v_first is not null and new.opening_date > v_first then
      raise exception 'Đã có bút toán từ ngày % nên ngày bắt đầu không được muộn hơn ngày đó.', to_char(v_first, 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cdilv_fund_validate on public.cdilv_funds;
create trigger trg_cdilv_fund_validate
  before insert or update or delete on public.cdilv_funds
  for each row execute function public.cdilv_trg_fund_validate();

-- Ghi mới (p_entry_id null) hoặc sửa bút toán. Dữ liệu đã kiểm tra ở API.
-- p_data: {entry_date, kind, fund_id, to_fund_id, category_id, amount, description, counterparty, document_no}
create or replace function public.cdilv_fund_entry_save(
  p_entry_id uuid,
  p_actor_id uuid,
  p_data jsonb,
  p_note text default null
)
returns public.cdilv_fund_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.cdilv_fund_entries;
begin
  if p_entry_id is null then
    insert into public.cdilv_fund_entries (
      entry_date, kind, fund_id, to_fund_id, category_id, amount, description, counterparty, document_no,
      created_by, updated_by
    ) values (
      (p_data->>'entry_date')::date,
      p_data->>'kind',
      (p_data->>'fund_id')::uuid,
      nullif(p_data->>'to_fund_id', '')::uuid,
      nullif(p_data->>'category_id', '')::uuid,
      (p_data->>'amount')::bigint,
      p_data->>'description',
      nullif(p_data->>'counterparty', ''),
      nullif(p_data->>'document_no', ''),
      p_actor_id,
      p_actor_id
    )
    returning * into v_entry;
    insert into public.cdilv_fund_entry_logs (entry_id, actor_id, action, note, snapshot)
    values (v_entry.id, p_actor_id, 'created', nullif(trim(coalesce(p_note, '')), ''), to_jsonb(v_entry));
  else
    update public.cdilv_fund_entries
    set entry_date = (p_data->>'entry_date')::date,
        fund_id = (p_data->>'fund_id')::uuid,
        to_fund_id = nullif(p_data->>'to_fund_id', '')::uuid,
        category_id = nullif(p_data->>'category_id', '')::uuid,
        amount = (p_data->>'amount')::bigint,
        description = p_data->>'description',
        counterparty = nullif(p_data->>'counterparty', ''),
        document_no = nullif(p_data->>'document_no', ''),
        updated_by = p_actor_id,
        updated_at = now()
    where id = p_entry_id
    returning * into v_entry;
    if not found then
      raise exception 'Không tìm thấy bút toán.' using errcode = 'P0002';
    end if;
    insert into public.cdilv_fund_entry_logs (entry_id, actor_id, action, note, snapshot)
    values (v_entry.id, p_actor_id, 'edited', nullif(trim(coalesce(p_note, '')), ''), to_jsonb(v_entry));
  end if;
  return v_entry;
end;
$$;

create or replace function public.cdilv_fund_entry_void(p_entry_id uuid, p_actor_id uuid, p_reason text)
returns public.cdilv_fund_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.cdilv_fund_entries;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_reason is null then
    raise exception 'Vui lòng ghi lý do hủy bút toán.' using errcode = 'P0001';
  end if;
  update public.cdilv_fund_entries
  set status = 'void', void_reason = v_reason, voided_by = p_actor_id, voided_at = now(),
      updated_by = p_actor_id, updated_at = now()
  where id = p_entry_id
  returning * into v_entry;
  if not found then
    raise exception 'Không tìm thấy bút toán.' using errcode = 'P0002';
  end if;
  insert into public.cdilv_fund_entry_logs (entry_id, actor_id, action, note, snapshot)
  values (v_entry.id, p_actor_id, 'voided', v_reason, to_jsonb(v_entry));
  return v_entry;
end;
$$;

-- Đề nghị thanh toán chuyển sang "Đã chi" → tự ghi phiếu chi. Không làm hỏng việc xác nhận chi:
-- nếu không ghi được (chưa có quỹ, kỳ đã khóa…) thì ghi chú vào lịch sử đề nghị để kế toán ghi tay.
create or replace function public.cdilv_trg_payment_request_paid_to_fund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount bigint := new.total_amount - new.advanced_amount;
  v_fund uuid;
  v_category uuid;
  v_all_visits boolean;
  v_entry public.cdilv_fund_entries;
begin
  if new.status <> 'paid' or old.status = 'paid' then
    return new;
  end if;
  if v_amount <= 0 then
    insert into public.cdilv_payment_request_logs (request_id, actor_id, action, from_status, to_status, note)
    values (new.id, new.paid_by, 'fund_skipped', 'paid', 'paid', 'Không ghi sổ quỹ: số đã tạm ứng bằng hoặc lớn hơn số thực trả.');
    return new;
  end if;

  select id into v_fund
  from public.cdilv_funds
  where kind = case new.payment_method when 'cash' then 'cash' else 'bank' end and is_active
  order by sort_order, created_at
  limit 1;

  select bool_and(visit_request_id is not null) into v_all_visits
  from public.cdilv_payment_request_items where request_id = new.id;

  select id into v_category
  from public.cdilv_fund_categories
  where system_key = case when coalesce(v_all_visits, false) then 'visit' else 'payment_default' end and is_active;
  if v_category is null then
    select id into v_category
    from public.cdilv_fund_categories where system_key = 'payment_default';
  end if;

  if v_fund is null or v_category is null then
    insert into public.cdilv_payment_request_logs (request_id, actor_id, action, from_status, to_status, note)
    values (new.id, new.paid_by, 'fund_skipped', 'paid', 'paid', 'Chưa ghi sổ quỹ: chưa có quỹ hoặc danh mục chi phù hợp.');
    return new;
  end if;

  begin
    v_entry := public.cdilv_fund_entry_save(
      null,
      new.paid_by,
      jsonb_build_object(
        'entry_date', (now() at time zone 'Asia/Ho_Chi_Minh')::date,
        'kind', 'expense',
        'fund_id', v_fund,
        'category_id', v_category,
        'amount', v_amount,
        'description', left('Chi theo đề nghị thanh toán ' || new.code || ' – ' || new.title, 300),
        'counterparty', left(coalesce(new.receiver_name, new.requester_name), 120),
        'document_no', new.code
      ),
      'Tự ghi khi xác nhận đã chi đề nghị ' || new.code
    );
    update public.cdilv_fund_entries set payment_request_id = new.id where id = v_entry.id;
    insert into public.cdilv_payment_request_logs (request_id, actor_id, action, from_status, to_status, note)
    values (new.id, new.paid_by, 'fund_posted', 'paid', 'paid', 'Đã ghi sổ quỹ: phiếu chi ' || v_entry.code);
  exception when others then
    insert into public.cdilv_payment_request_logs (request_id, actor_id, action, from_status, to_status, note)
    values (new.id, new.paid_by, 'fund_skipped', 'paid', 'paid', left('Chưa ghi sổ quỹ: ' || sqlerrm, 1000));
  end;
  return new;
end;
$$;

drop trigger if exists trg_cdilv_payment_request_paid_to_fund on public.cdilv_payment_requests;
create trigger trg_cdilv_payment_request_paid_to_fund
  after update of status on public.cdilv_payment_requests
  for each row execute function public.cdilv_trg_payment_request_paid_to_fund();

-- -----------------------------------------------------------------------------
-- Dữ liệu ban đầu (chỉ khi bảng còn trống)
-- -----------------------------------------------------------------------------
insert into public.cdilv_funds (kind, name, opening_balance, opening_date, sort_order)
select * from (values
  ('cash', 'Tiền mặt', 0::bigint, date '2026-01-01', 1),
  ('bank', 'Tiền gửi ngân hàng', 0::bigint, date '2026-01-01', 2)
) as v(kind, name, opening_balance, opening_date, sort_order)
where not exists (select 1 from public.cdilv_funds);

insert into public.cdilv_fund_categories (kind, name, system_key, sort_order)
select * from (values
  ('income', 'Thu đoàn phí công đoàn', null, 10),
  ('income', 'Thu kinh phí công đoàn được phân phối', null, 20),
  ('income', 'Thu hỗ trợ từ doanh nghiệp', null, 30),
  ('income', 'Lãi tiền gửi ngân hàng', null, 40),
  ('income', 'Thu khác', null, 90),
  ('expense', 'Phụ cấp cán bộ công đoàn', null, 10),
  ('expense', 'Chi quản lý hành chính', null, 20),
  ('expense', 'Chi tuyên truyền, phát triển đoàn viên', null, 30),
  ('expense', 'Chi hoạt động đại diện, bảo vệ quyền lợi đoàn viên', null, 40),
  ('expense', 'Chi văn hóa, thể thao, du lịch', null, 50),
  ('expense', 'Chi thăm hỏi, trợ cấp đoàn viên', 'visit', 60),
  ('expense', 'Chi khen thưởng', null, 70),
  ('expense', 'Nộp đoàn phí, kinh phí lên công đoàn cấp trên', null, 80),
  ('expense', 'Chi hoạt động phong trào khác', 'payment_default', 85),
  ('expense', 'Chi khác', null, 90)
) as v(kind, name, system_key, sort_order)
where not exists (select 1 from public.cdilv_fund_categories);

-- -----------------------------------------------------------------------------
-- Quyền truy cập: chỉ service role
-- -----------------------------------------------------------------------------
alter table public.cdilv_funds enable row level security;
alter table public.cdilv_fund_categories enable row level security;
alter table public.cdilv_fund_entries enable row level security;
alter table public.cdilv_fund_entry_logs enable row level security;

revoke all on
  public.cdilv_funds,
  public.cdilv_fund_categories,
  public.cdilv_fund_entries,
  public.cdilv_fund_entry_logs
from anon, authenticated;

grant select, insert, update, delete on
  public.cdilv_funds,
  public.cdilv_fund_categories,
  public.cdilv_fund_entries,
  public.cdilv_fund_entry_logs
to service_role;

revoke all on function public.cdilv_guard_fund_entry_logs() from public, anon, authenticated;
revoke all on function public.cdilv_fund_locked_through() from public, anon, authenticated;
revoke all on function public.cdilv_trg_fund_entry_number() from public, anon, authenticated;
revoke all on function public.cdilv_trg_fund_entry_validate() from public, anon, authenticated;
revoke all on function public.cdilv_trg_fund_validate() from public, anon, authenticated;
revoke all on function public.cdilv_trg_payment_request_paid_to_fund() from public, anon, authenticated;
revoke all on function public.cdilv_fund_entry_save(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.cdilv_fund_entry_void(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cdilv_fund_locked_through() to service_role;
grant execute on function public.cdilv_fund_entry_save(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.cdilv_fund_entry_void(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
