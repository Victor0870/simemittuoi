-- =============================================================================
-- Sổ quỹ – xử lý tiền gửi tiết kiệm khi đáo hạn
-- - Nhắc đáo hạn: thông báo (cdilv_notifications, type 'savings_maturity') cho Chủ tịch và Kế toán theo
--   Cài đặt công đoàn (cán bộ đang hoạt động, chức danh đang dùng, có liên kết tài khoản đã duyệt);
--   không có ai thì gửi cho người có quyền finance.manage. Mỗi sổ nhắc 2 lần cho mỗi ngày đáo hạn:
--   trước 7 ngày ('upcoming') và khi đến hạn / quá hạn ('due'). Sổ đã hết tiền hoặc ngừng dùng thì không nhắc.
--   Hàm cdilv_notify_savings_maturity() gọi từ API thông báo (giới hạn tần suất) và từ pg_cron nếu có.
-- - Danh mục thu hệ thống 'savings_interest' (Lãi tiền gửi ngân hàng) dùng khi ghi lãi tự động.
-- - cdilv_savings_mature: Tất toán (ghi lãi vào sổ, chuyển toàn bộ số dư về quỹ chi được, ngừng dùng sổ)
--   hoặc Tái tục (ghi lãi nhập gốc hoặc trả về quỹ chi được, đặt ngày đáo hạn / lãi suất mới) trong một giao dịch.
-- =============================================================================

alter table public.cdilv_fund_categories drop constraint if exists cdilv_fund_categories_system_key_check;
alter table public.cdilv_fund_categories
  add constraint cdilv_fund_categories_system_key_check
  check (system_key is null or system_key in ('visit', 'payment_default', 'savings_interest'));

do $$
begin
  if not exists (select 1 from public.cdilv_fund_categories where system_key = 'savings_interest') then
    update public.cdilv_fund_categories
    set system_key = 'savings_interest', updated_at = now()
    where id = (
      select id from public.cdilv_fund_categories
      where kind = 'income' and system_key is null and lower(btrim(name)) = lower('Lãi tiền gửi ngân hàng')
      order by is_active desc, sort_order
      limit 1
    );
    if not found then
      insert into public.cdilv_fund_categories (kind, name, system_key, sort_order)
      values ('income', 'Lãi tiền gửi ngân hàng', 'savings_interest', 40);
    end if;
  end if;
end;
$$;

create table if not exists public.cdilv_savings_reminders (
  fund_id uuid not null references public.cdilv_funds(id) on delete cascade,
  maturity_date date not null,
  stage text not null check (stage in ('upcoming', 'due')),
  sent_at timestamptz not null default now(),
  primary key (fund_id, maturity_date, stage)
);

alter table public.cdilv_savings_reminders enable row level security;
revoke all on table public.cdilv_savings_reminders from public, anon, authenticated;

-- Số dư một quỹ đến hết ngày p_until (null = mọi bút toán đã ghi).
create or replace function public.cdilv_fund_balance(p_fund_id uuid, p_until date default null)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select f.opening_balance + coalesce((
    select sum(
      case
        when e.kind = 'income' and e.fund_id = f.id then e.amount
        when e.kind = 'expense' and e.fund_id = f.id then -e.amount
        when e.kind = 'transfer' and e.fund_id = f.id then -e.amount
        when e.kind = 'transfer' and e.to_fund_id = f.id then e.amount
        else 0
      end)
    from public.cdilv_fund_entries e
    where e.status = 'posted'
      and (e.fund_id = f.id or e.to_fund_id = f.id)
      and (p_until is null or e.entry_date <= p_until)
  ), 0)::bigint
  from public.cdilv_funds f
  where f.id = p_fund_id;
$$;

-- Người nhận nhắc đáo hạn: Chủ tịch và Kế toán (không gồm Phó chủ tịch) có liên kết tài khoản.
create or replace function public.cdilv_savings_maturity_recipients()
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select distinct o.user_id
  from public.cdilv_union_officers o
  join public.cdilv_union_positions p on p.id = o.position_id
  join public.cdilv_profiles pr on pr.id = o.user_id
  where o.is_active
    and p.is_active
    and pr.approval_status = 'approved'
    and (lower(btrim(p.name)) like 'chủ tịch%' or lower(btrim(p.name)) like 'kế toán%');
  if not found then
    return query select uid from public.cdilv_users_with_permission('finance.manage') as uid;
  end if;
end;
$$;

-- Gửi nhắc cho các sổ tiết kiệm sắp / đã đến hạn. Trả về số lượt nhắc mới (theo sổ).
create or replace function public.cdilv_notify_savings_maturity(p_days_before integer default 7)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  r record;
  v_stage text;
  v_days integer;
  v_balance bigint;
  v_count integer := 0;
begin
  for r in
    select id, name, bank_name, maturity_date
    from public.cdilv_funds
    where kind = 'savings'
      and is_active
      and maturity_date is not null
      and maturity_date <= v_today + p_days_before
    order by maturity_date
  loop
    v_days := r.maturity_date - v_today;
    v_stage := case when v_days <= 0 then 'due' else 'upcoming' end;
    if exists (
      select 1 from public.cdilv_savings_reminders
      where fund_id = r.id and maturity_date = r.maturity_date and (stage = v_stage or stage = 'due')
    ) then
      continue;
    end if;
    v_balance := public.cdilv_fund_balance(r.id);
    if v_balance <= 0 then
      continue;
    end if;

    insert into public.cdilv_savings_reminders (fund_id, maturity_date, stage)
    values (r.id, r.maturity_date, v_stage)
    on conflict do nothing;
    if not found then
      continue;
    end if;

    insert into public.cdilv_notifications (user_id, type, title, message, link, actor_id)
    select
      uid,
      'savings_maturity',
      case
        when v_days < 0 then 'Sổ tiết kiệm quá hạn ' || (-v_days) || ' ngày'
        when v_days = 0 then 'Sổ tiết kiệm đến hạn hôm nay'
        else 'Sổ tiết kiệm sắp đáo hạn (còn ' || v_days || ' ngày)'
      end,
      r.name || coalesce(' – ' || r.bank_name, '') || ': đáo hạn ' || to_char(r.maturity_date, 'DD/MM/YYYY')
        || ', số dư ' || replace(to_char(v_balance, 'FM999,999,999,999'), ',', '.') || 'đ. Vào Sổ quỹ bấm Tất toán / Tái tục để ghi lãi và xử lý sổ.',
      '/admin/finance/ledger?fund=' || r.id,
      null
    from public.cdilv_savings_maturity_recipients() as uid;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Tất toán / tái tục một sổ tiết kiệm. Dữ liệu đã kiểm tra ở API.
-- p_data: {action: settle|renew, entry_date, interest_amount, interest_fund_id?, target_fund_id?,
--          new_maturity_date?, new_interest_rate?, document_no?}
--   settle: lãi ghi vào chính sổ, rồi chuyển toàn bộ số dư (đến hết entry_date) sang target_fund_id, sổ ngừng dùng.
--   renew:  lãi ghi vào interest_fund_id (null = nhập gốc vào sổ), đặt ngày đáo hạn và lãi suất mới.
create or replace function public.cdilv_savings_mature(p_fund_id uuid, p_actor_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fund public.cdilv_funds;
  v_action text := p_data->>'action';
  v_date date := (p_data->>'entry_date')::date;
  v_interest bigint := coalesce((p_data->>'interest_amount')::bigint, 0);
  v_target uuid := nullif(p_data->>'target_fund_id', '')::uuid;
  v_interest_fund uuid := nullif(p_data->>'interest_fund_id', '')::uuid;
  v_new_maturity date := nullif(p_data->>'new_maturity_date', '')::date;
  v_new_rate numeric := nullif(p_data->>'new_interest_rate', '')::numeric;
  v_doc text := nullif(btrim(coalesce(p_data->>'document_no', '')), '');
  v_category uuid;
  v_label text;
  v_balance bigint;
  v_entry public.cdilv_fund_entries;
  v_codes text[] := '{}';
begin
  select * into v_fund from public.cdilv_funds where id = p_fund_id for update;
  if not found or v_fund.kind <> 'savings' then
    raise exception 'Không tìm thấy sổ tiết kiệm.' using errcode = 'P0001';
  end if;
  if not v_fund.is_active then
    raise exception 'Sổ tiết kiệm đã ngừng sử dụng.' using errcode = 'P0001';
  end if;
  if v_action not in ('settle', 'renew') then
    raise exception 'Cách xử lý không hợp lệ.' using errcode = 'P0001';
  end if;
  if v_interest < 0 then
    raise exception 'Tiền lãi không hợp lệ.' using errcode = 'P0001';
  end if;

  if v_action = 'renew' then
    if v_new_maturity is null or v_new_maturity <= v_date then
      raise exception 'Ngày đáo hạn mới phải sau ngày ghi sổ.' using errcode = 'P0001';
    end if;
    v_target := v_interest_fund;
  elsif v_target is null then
    raise exception 'Vui lòng chọn quỹ nhận tiền tất toán.' using errcode = 'P0001';
  end if;

  if v_target is not null and not exists (
    select 1 from public.cdilv_funds where id = v_target and kind in ('cash', 'bank') and is_active
  ) then
    raise exception 'Quỹ nhận phải là tiền mặt hoặc tài khoản thanh toán đang sử dụng.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.cdilv_fund_entries
    where status = 'posted' and entry_date > v_date and (fund_id = p_fund_id or to_fund_id = p_fund_id)
  ) then
    raise exception 'Sổ đã có bút toán sau ngày %. Chọn ngày ghi sổ muộn hơn.', to_char(v_date, 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;

  v_label := v_fund.name || coalesce(' (sổ ' || v_fund.bank_account_no || ')', '');

  if v_interest > 0 then
    select id into v_category
    from public.cdilv_fund_categories
    where system_key = 'savings_interest' and kind = 'income' and is_active;
    if v_category is null then
      raise exception 'Chưa có danh mục thu "Lãi tiền gửi ngân hàng" đang dùng.' using errcode = 'P0001';
    end if;
    v_entry := public.cdilv_fund_entry_save(
      null,
      p_actor_id,
      jsonb_build_object(
        'entry_date', v_date,
        'kind', 'income',
        'fund_id', case when v_action = 'renew' then coalesce(v_target, p_fund_id) else p_fund_id end,
        'category_id', v_category,
        'amount', v_interest,
        'description', left('Lãi tiền gửi tiết kiệm ' || v_label
          || coalesce(' đáo hạn ' || to_char(v_fund.maturity_date, 'DD/MM/YYYY'), ''), 300),
        'counterparty', left(v_fund.bank_name, 120),
        'document_no', v_doc
      ),
      case when v_action = 'settle' then 'Tất toán sổ tiết kiệm' else 'Tái tục sổ tiết kiệm' end
    );
    v_codes := v_codes || v_entry.code;
  end if;

  if v_action = 'settle' then
    v_balance := public.cdilv_fund_balance(p_fund_id, v_date);
    if v_balance <= 0 then
      raise exception 'Sổ không còn số dư để tất toán.' using errcode = 'P0001';
    end if;
    v_entry := public.cdilv_fund_entry_save(
      null,
      p_actor_id,
      jsonb_build_object(
        'entry_date', v_date,
        'kind', 'transfer',
        'fund_id', p_fund_id,
        'to_fund_id', v_target,
        'amount', v_balance,
        'description', left('Tất toán sổ tiết kiệm ' || v_label || ' (gốc và lãi)', 300),
        'counterparty', left(v_fund.bank_name, 120),
        'document_no', v_doc
      ),
      'Tất toán sổ tiết kiệm'
    );
    v_codes := v_codes || v_entry.code;
    update public.cdilv_funds
    set is_active = false, updated_by = p_actor_id, updated_at = now()
    where id = p_fund_id;
  else
    update public.cdilv_funds
    set maturity_date = v_new_maturity,
        interest_rate = coalesce(v_new_rate, interest_rate),
        updated_by = p_actor_id,
        updated_at = now()
    where id = p_fund_id;
  end if;

  update public.cdilv_notifications
  set is_read = true
  where type = 'savings_maturity' and link = '/admin/finance/ledger?fund=' || p_fund_id and not is_read;

  return jsonb_build_object('codes', to_jsonb(v_codes), 'balance', public.cdilv_fund_balance(p_fund_id));
end;
$$;

revoke all on function public.cdilv_fund_balance(uuid, date) from public, anon, authenticated;
revoke all on function public.cdilv_savings_maturity_recipients() from public, anon, authenticated;
revoke all on function public.cdilv_notify_savings_maturity(integer) from public, anon, authenticated;
revoke all on function public.cdilv_savings_mature(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.cdilv_notify_savings_maturity(integer) to service_role;
grant execute on function public.cdilv_savings_mature(uuid, uuid, jsonb) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'cdilv_notify_savings_maturity') then
      perform cron.unschedule('cdilv_notify_savings_maturity');
    end if;
    perform cron.schedule(
      'cdilv_notify_savings_maturity',
      '0 1 * * *',
      'select public.cdilv_notify_savings_maturity()'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
