-- =============================================================================
-- Sổ quỹ – tách tiền gửi tiết kiệm khỏi tài khoản thanh toán
-- - Loại quỹ mới 'savings' (Tiền gửi tiết kiệm): số sổ / hợp đồng, ngân hàng, lãi suất, ngày đáo hạn.
-- - Quỹ tiết kiệm không chi trực tiếp: chỉ nhận lãi (phiếu thu) và chuyển quỹ qua lại với tài khoản / tiền mặt.
-- - Đề nghị thanh toán chuyển khoản vẫn chỉ tự ghi vào quỹ loại 'bank' (không bao giờ vào sổ tiết kiệm).
-- =============================================================================

alter table public.cdilv_funds drop constraint if exists cdilv_funds_kind_check;
alter table public.cdilv_funds
  add constraint cdilv_funds_kind_check check (kind in ('cash', 'bank', 'savings'));

alter table public.cdilv_funds
  add column if not exists interest_rate numeric(5, 2)
    check (interest_rate is null or (interest_rate >= 0 and interest_rate <= 100)),
  add column if not exists maturity_date date;

create or replace function public.cdilv_trg_fund_entry_c_savings_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'expense'
     and new.status = 'posted'
     and (tg_op = 'INSERT' or new.fund_id is distinct from old.fund_id)
     and exists (select 1 from public.cdilv_funds where id = new.fund_id and kind = 'savings') then
    raise exception 'Không chi trực tiếp từ quỹ tiết kiệm. Hãy ghi phiếu chuyển quỹ về tài khoản thanh toán hoặc tiền mặt trước.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cdilv_fund_entry_c_savings_guard on public.cdilv_fund_entries;
create trigger trg_cdilv_fund_entry_c_savings_guard
  before insert or update of fund_id on public.cdilv_fund_entries
  for each row execute function public.cdilv_trg_fund_entry_c_savings_guard();

create or replace function public.cdilv_trg_fund_kind_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'savings' and old.kind <> 'savings' and exists (
    select 1 from public.cdilv_fund_entries
    where fund_id = new.id and kind = 'expense' and status = 'posted'
  ) then
    raise exception 'Quỹ đã có phiếu chi nên không đổi sang loại tiền gửi tiết kiệm được.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cdilv_fund_kind_guard on public.cdilv_funds;
create trigger trg_cdilv_fund_kind_guard
  before update of kind on public.cdilv_funds
  for each row execute function public.cdilv_trg_fund_kind_guard();

revoke all on function public.cdilv_trg_fund_entry_c_savings_guard() from public, anon, authenticated;
revoke all on function public.cdilv_trg_fund_kind_guard() from public, anon, authenticated;
