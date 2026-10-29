-- =============================================================================
-- Quản lý sổ tiết kiệm:
-- 1. Thêm các trường cho sổ tiết kiệm trong cdilv_funds:
--    - interest_rate_type: 'fixed' (cố định) | 'floating' (thả nổi)
--    - term_months: kỳ hạn gửi (tháng)
--    - interest_period: chu kỳ tính/lĩnh lãi ('monthly', 'end_of_term', 'quarterly', 'yearly')
--    - deposit_date: ngày gửi (nếu khác opening_date)
--    - notes: ghi chú về sổ tiết kiệm
-- 2. Bảng cdilv_savings_monthly_rates: lưu lãi suất và tiền lãi hàng tháng
--    cho từng sổ tiết kiệm thả nổi khi kế toán nhập cuối mỗi tháng.
-- =============================================================================

alter table public.cdilv_funds
  add column if not exists interest_rate_type text default 'fixed'
    check (interest_rate_type is null or interest_rate_type in ('fixed', 'floating')),
  add column if not exists term_months integer
    check (term_months is null or term_months > 0),
  add column if not exists interest_period text default 'monthly'
    check (interest_period is null or interest_period in ('monthly', 'end_of_term', 'quarterly', 'yearly')),
  add column if not exists deposit_date date,
  add column if not exists notes text;

update public.cdilv_funds
set interest_rate_type = 'fixed'
where kind = 'savings' and interest_rate_type is null;

create table if not exists public.cdilv_savings_monthly_rates (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.cdilv_funds(id) on delete cascade,
  period_month text not null check (period_month ~ '^\d{4}-\d{2}$'),
  interest_rate numeric(5, 2) not null check (interest_rate >= 0 and interest_rate <= 100),
  principal_amount bigint not null default 0 check (principal_amount >= 0),
  interest_amount bigint not null default 0 check (interest_amount >= 0),
  days_in_month integer check (days_in_month is null or (days_in_month between 28 and 31)),
  calculation_formula text,
  is_collected boolean not null default false,
  collected_entry_id uuid references public.cdilv_fund_entries(id) on delete set null,
  collected_at timestamptz,
  note text,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cdilv_savings_monthly_rates_fund_period_unique unique (fund_id, period_month)
);

create index if not exists idx_cdilv_savings_monthly_rates_fund on public.cdilv_savings_monthly_rates(fund_id);
create index if not exists idx_cdilv_savings_monthly_rates_period on public.cdilv_savings_monthly_rates(period_month);

alter table public.cdilv_savings_monthly_rates enable row level security;

drop policy if exists cdilv_savings_monthly_rates_select on public.cdilv_savings_monthly_rates;
create policy cdilv_savings_monthly_rates_select on public.cdilv_savings_monthly_rates
  for select to authenticated
  using (public.cdilv_has_permission('finance.view'));

drop policy if exists cdilv_savings_monthly_rates_insert on public.cdilv_savings_monthly_rates;
create policy cdilv_savings_monthly_rates_insert on public.cdilv_savings_monthly_rates
  for insert to authenticated
  with check (public.cdilv_has_permission('finance.record'));

drop policy if exists cdilv_savings_monthly_rates_update on public.cdilv_savings_monthly_rates;
create policy cdilv_savings_monthly_rates_update on public.cdilv_savings_monthly_rates
  for update to authenticated
  using (public.cdilv_has_permission('finance.record'))
  with check (public.cdilv_has_permission('finance.record'));

drop policy if exists cdilv_savings_monthly_rates_delete on public.cdilv_savings_monthly_rates;
create policy cdilv_savings_monthly_rates_delete on public.cdilv_savings_monthly_rates
  for delete to authenticated
  using (public.cdilv_has_permission('finance.manage'));

grant select, insert, update, delete on public.cdilv_savings_monthly_rates to authenticated, service_role;
