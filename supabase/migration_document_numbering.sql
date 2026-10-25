-- Văn bản công đoàn – Số văn bản tự động.
-- cdilv_document_number_series: mẫu số theo loại văn bản (người có quyền posts.manage sửa qua API) và chu kỳ đếm
--   yearly (mặc định) hoặc monthly. Biến trong mẫu: {so} số thứ tự (đệm số 0 theo pad), {yy}, {yyyy}, {mm}.
--   Đếm theo tháng thì mẫu phải có {mm} để số không trùng trong năm (ràng buộc số duy nhất theo loại + năm).
-- cdilv_document_number_counters: bộ đếm theo loại + kỳ ('YYYY' hoặc 'YYYY-MM').
-- cdilv_document_issue: ban hành bản nháp trong một giao dịch – khóa văn bản và dòng bộ đếm (FOR UPDATE),
--   bỏ qua số đã dùng (kể cả số nhập tay), cập nhật văn bản rồi mới tăng bộ đếm; trùng số thì không đổi gì.
--   p_number khác null: số nhập tay (API chỉ cho Quản trị viên), không tăng bộ đếm, vẫn chịu ràng buộc số duy nhất.
-- Không đổi số của văn bản đã ban hành; chỉ thêm 4 dòng mẫu số mặc định theo kiểu số hiện có (01-26/QĐ-CĐCS).

begin;

create table if not exists public.cdilv_document_number_series (
  doc_type text primary key check (char_length(doc_type) between 1 and 40),
  format text not null check (char_length(format) between 4 and 40 and position('{so}' in format) > 0),
  pad smallint not null default 2 check (pad between 1 and 5),
  reset_period text not null default 'yearly' check (reset_period in ('yearly', 'monthly')),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint cdilv_document_number_series_monthly_check
    check (reset_period = 'yearly' or position('{mm}' in format) > 0)
);

create table if not exists public.cdilv_document_number_counters (
  doc_type text not null,
  period text not null check (period ~ '^[0-9]{4}(-[0-9]{2})?$'),
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (doc_type, period)
);

insert into public.cdilv_document_number_series (doc_type, format)
values
  ('quyet_dinh', '{so}-{yy}/QĐ-CĐCS'),
  ('quy_dinh', '{so}-{yy}/QyĐ-CĐCS'),
  ('bien_ban_lam_viec', '{so}-{yy}/BBLV-CĐCS'),
  ('bien_ban_cuoc_hop', '{so}-{yy}/BB-CĐCS')
on conflict (doc_type) do nothing;

create or replace function public.cdilv_document_number_format(p_format text, p_pad integer, p_seq integer, p_date date)
returns text
language sql
immutable
set search_path = public
as $$
  select replace(replace(replace(replace(
    p_format,
    '{so}', case when char_length(p_seq::text) >= p_pad then p_seq::text else lpad(p_seq::text, p_pad, '0') end),
    '{yyyy}', to_char(p_date, 'YYYY')),
    '{yy}', to_char(p_date, 'YY')),
    '{mm}', to_char(p_date, 'MM'));
$$;

-- Số trống đầu tiên sau p_from (bỏ qua số đã dùng cho văn bản cùng loại, cùng năm ban hành).
create or replace function public.cdilv_document_number_next(
  p_type text,
  p_date date,
  p_from integer,
  p_format text,
  p_pad integer,
  out o_seq integer,
  out o_number text
)
language plpgsql
stable
set search_path = public
as $$
begin
  o_seq := coalesce(p_from, 0);
  loop
    o_seq := o_seq + 1;
    o_number := public.cdilv_document_number_format(p_format, p_pad, o_seq, p_date);
    exit when not exists (
      select 1
      from public.cdilv_documents d
      where d.status = 'da_ban_hanh'
        and d.type = p_type
        and lower(btrim(d.so_van_ban)) = lower(btrim(o_number))
        and extract(year from d.ngay_ban_hanh) = extract(year from p_date)
    );
    if o_seq > coalesce(p_from, 0) + 10000 then
      raise exception 'Không tìm được số văn bản trống.' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

create or replace function public.cdilv_document_number_period(p_reset text, p_date date)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_reset = 'monthly' then to_char(p_date, 'YYYY-MM') else to_char(p_date, 'YYYY') end;
$$;

-- Số dự kiến (không tăng bộ đếm) – hiển thị trong hộp thoại ban hành.
create or replace function public.cdilv_document_number_preview(p_type text, p_date date)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_series public.cdilv_document_number_series;
  v_last integer;
begin
  select * into v_series from public.cdilv_document_number_series where doc_type = p_type;
  if not found then
    v_series.format := '{so}';
    v_series.pad := 2;
    v_series.reset_period := 'yearly';
  end if;
  select c.last_value into v_last
  from public.cdilv_document_number_counters c
  where c.doc_type = p_type and c.period = public.cdilv_document_number_period(v_series.reset_period, p_date);
  return (public.cdilv_document_number_next(p_type, p_date, coalesce(v_last, 0), v_series.format, v_series.pad)).o_number;
end;
$$;

-- Ban hành bản nháp. Trả về {ok: true, so_van_ban} hoặc {ok: false, reason: not_found | not_draft | duplicate}.
create or replace function public.cdilv_document_issue(
  p_id uuid,
  p_date date,
  p_scan_path text,
  p_actor_id uuid,
  p_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_status text;
  v_series public.cdilv_document_number_series;
  v_period text;
  v_last integer;
  v_seq integer;
  v_number text;
begin
  select d.type, d.status into v_type, v_status from public.cdilv_documents d where d.id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_status <> 'nhap' then
    return jsonb_build_object('ok', false, 'reason', 'not_draft');
  end if;

  if nullif(btrim(coalesce(p_number, '')), '') is not null then
    v_number := btrim(p_number);
  else
    select * into v_series from public.cdilv_document_number_series where doc_type = v_type;
    if not found then
      v_series.format := '{so}';
      v_series.pad := 2;
      v_series.reset_period := 'yearly';
    end if;
    v_period := public.cdilv_document_number_period(v_series.reset_period, p_date);
    insert into public.cdilv_document_number_counters (doc_type, period)
    values (v_type, v_period)
    on conflict (doc_type, period) do nothing;
    select c.last_value into v_last
    from public.cdilv_document_number_counters c
    where c.doc_type = v_type and c.period = v_period
    for update;
    select n.o_seq, n.o_number into v_seq, v_number
    from public.cdilv_document_number_next(v_type, p_date, v_last, v_series.format, v_series.pad) n;
  end if;

  begin
    update public.cdilv_documents
    set status = 'da_ban_hanh',
        so_van_ban = v_number,
        ngay_ban_hanh = p_date,
        scan_path = p_scan_path,
        issued_at = now(),
        issued_by = p_actor_id,
        updated_at = now()
    where id = p_id;
    if v_seq is not null then
      update public.cdilv_document_number_counters
      set last_value = v_seq, updated_at = now()
      where doc_type = v_type and period = v_period;
    end if;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'duplicate');
  end;

  return jsonb_build_object('ok', true, 'so_van_ban', v_number);
end;
$$;

alter table public.cdilv_document_number_series enable row level security;
alter table public.cdilv_document_number_counters enable row level security;

revoke all on public.cdilv_document_number_series, public.cdilv_document_number_counters from anon, authenticated;
grant select, insert, update, delete on public.cdilv_document_number_series, public.cdilv_document_number_counters to service_role;

revoke all on function public.cdilv_document_number_format(text, integer, integer, date) from public, anon, authenticated;
revoke all on function public.cdilv_document_number_next(text, date, integer, text, integer) from public, anon, authenticated;
revoke all on function public.cdilv_document_number_period(text, date) from public, anon, authenticated;
revoke all on function public.cdilv_document_number_preview(text, date) from public, anon, authenticated;
revoke all on function public.cdilv_document_issue(uuid, date, text, uuid, text) from public, anon, authenticated;
grant execute on function public.cdilv_document_number_format(text, integer, integer, date) to service_role;
grant execute on function public.cdilv_document_number_next(text, date, integer, text, integer) to service_role;
grant execute on function public.cdilv_document_number_period(text, date) to service_role;
grant execute on function public.cdilv_document_number_preview(text, date) to service_role;
grant execute on function public.cdilv_document_issue(uuid, date, text, uuid, text) to service_role;

commit;

notify pgrst, 'reload schema';
