-- Văn bản công đoàn – Số văn bản tự động: "Bắt đầu từ số" cho kỳ đếm hiện tại.
-- Dùng khi chuyển từ sổ văn bản giấy sang web: VD số giấy cuối là 37 thì đặt bắt đầu từ 38.
-- cdilv_document_number_counters.start_value: số bắt đầu của kỳ (mặc định 1).
-- Số đã cấp gần nhất trong kỳ = max(bộ đếm, số thứ tự lớn nhất đọc được từ các văn bản đã ban hành cùng loại trong kỳ
--   khớp mẫu số hiện tại – gồm cả số nhập tay). Số tiếp theo = max(start_value, số đã cấp gần nhất + 1), vẫn bỏ qua số đã dùng.
-- cdilv_document_number_configure: lưu mẫu số + số bắt đầu trong một giao dịch, khóa dòng bộ đếm;
--   số bắt đầu mới phải lớn hơn số đã cấp gần nhất trong kỳ (không lùi số).
-- Chỉ thêm cột (mặc định 1) và thay thân hàm; không đổi dữ liệu, không đổi số đã ban hành.

begin;

alter table public.cdilv_document_number_counters
  add column if not exists start_value integer not null default 1;

alter table public.cdilv_document_number_counters
  drop constraint if exists cdilv_document_number_counters_start_check;
alter table public.cdilv_document_number_counters
  add constraint cdilv_document_number_counters_start_check check (start_value between 1 and 999999);

-- Số thứ tự lớn nhất đã ban hành trong kỳ chứa p_date, đọc theo mẫu số p_format; 0 nếu chưa có.
create or replace function public.cdilv_document_number_last_issued(p_type text, p_format text, p_reset text, p_date date)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_pattern text;
  v_from date;
  v_to date;
  v_max integer;
begin
  v_pattern := regexp_replace(p_format, '([.^$*+?()\[\]{}|\\/-])', '\\\1', 'g');
  v_pattern := replace(v_pattern, '\{so\}', '([0-9]{1,6})');
  v_pattern := replace(v_pattern, '\{yyyy\}', to_char(p_date, 'YYYY'));
  v_pattern := replace(v_pattern, '\{yy\}', to_char(p_date, 'YY'));
  v_pattern := replace(v_pattern, '\{mm\}', case when p_reset = 'monthly' then to_char(p_date, 'MM') else '[0-9]{2}' end);
  if p_reset = 'monthly' then
    v_from := date_trunc('month', p_date)::date;
    v_to := (v_from + interval '1 month')::date;
  else
    v_from := date_trunc('year', p_date)::date;
    v_to := (v_from + interval '1 year')::date;
  end if;
  select max((regexp_match(btrim(d.so_van_ban), '^' || v_pattern || '$', 'i'))[1]::integer) into v_max
  from public.cdilv_documents d
  where d.status = 'da_ban_hanh'
    and d.type = p_type
    and d.ngay_ban_hanh >= v_from
    and d.ngay_ban_hanh < v_to;
  return coalesce(v_max, 0);
end;
$$;

-- Trạng thái số của các loại cho kỳ chứa p_date: {loại: {period, start, last, next}} (không tăng bộ đếm).
create or replace function public.cdilv_document_number_state(p_types text[], p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_series public.cdilv_document_number_series;
  v_period text;
  v_counter_last integer;
  v_start integer;
  v_last integer;
  v_result jsonb := '{}'::jsonb;
begin
  foreach v_type in array p_types loop
    select * into v_series from public.cdilv_document_number_series where doc_type = v_type;
    if not found then
      v_series.format := '{so}';
      v_series.pad := 2;
      v_series.reset_period := 'yearly';
    end if;
    v_period := public.cdilv_document_number_period(v_series.reset_period, p_date);
    v_counter_last := null;
    v_start := null;
    select c.last_value, c.start_value into v_counter_last, v_start
    from public.cdilv_document_number_counters c
    where c.doc_type = v_type and c.period = v_period;
    v_last := greatest(
      coalesce(v_counter_last, 0),
      public.cdilv_document_number_last_issued(v_type, v_series.format, v_series.reset_period, p_date)
    );
    v_result := v_result || jsonb_build_object(v_type, jsonb_build_object(
      'period', v_period,
      'start', coalesce(v_start, 1),
      'last', v_last,
      'next', (public.cdilv_document_number_next(
        v_type, p_date, greatest(v_last, coalesce(v_start, 1) - 1), v_series.format, v_series.pad
      )).o_number
    ));
  end loop;
  return v_result;
end;
$$;

-- Số dự kiến (không tăng bộ đếm) – hiển thị trong hộp thoại ban hành.
create or replace function public.cdilv_document_number_preview(p_type text, p_date date)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.cdilv_document_number_state(array[p_type], p_date) -> p_type ->> 'next';
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
  v_counter_last integer;
  v_start integer;
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
    select c.last_value, c.start_value into v_counter_last, v_start
    from public.cdilv_document_number_counters c
    where c.doc_type = v_type and c.period = v_period
    for update;
    v_last := greatest(
      v_counter_last,
      public.cdilv_document_number_last_issued(v_type, v_series.format, v_series.reset_period, p_date)
    );
    select n.o_seq, n.o_number into v_seq, v_number
    from public.cdilv_document_number_next(v_type, p_date, greatest(v_last, v_start - 1), v_series.format, v_series.pad) n;
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

-- Lưu cấu hình số. p_series: [{type, format, pad, reset, start}] (đã kiểm tra ở API).
-- Số bắt đầu áp dụng cho kỳ chứa p_date theo chu kỳ mới; chỉ kiểm tra khi số bắt đầu thay đổi.
-- Trả về {ok: true} hoặc {ok: false, reason: 'start_too_low', type, last} (khi đó không lưu gì).
create or replace function public.cdilv_document_number_configure(p_series jsonb, p_date date, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_type text;
  v_format text;
  v_reset text;
  v_start integer;
  v_period text;
  v_current integer;
  v_counter_last integer;
  v_last integer;
begin
  for v_item in select value from jsonb_array_elements(p_series) loop
    v_type := v_item->>'type';
    v_format := v_item->>'format';
    v_reset := v_item->>'reset';
    v_start := (v_item->>'start')::integer;
    v_period := public.cdilv_document_number_period(v_reset, p_date);
    select c.start_value into v_current
    from public.cdilv_document_number_counters c
    where c.doc_type = v_type and c.period = v_period;
    if v_start is distinct from coalesce(v_current, 1) then
      insert into public.cdilv_document_number_counters (doc_type, period)
      values (v_type, v_period)
      on conflict (doc_type, period) do nothing;
      select c.last_value into v_counter_last
      from public.cdilv_document_number_counters c
      where c.doc_type = v_type and c.period = v_period
      for update;
      v_last := greatest(v_counter_last, public.cdilv_document_number_last_issued(v_type, v_format, v_reset, p_date));
      if v_start <= v_last then
        return jsonb_build_object('ok', false, 'reason', 'start_too_low', 'type', v_type, 'last', v_last);
      end if;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_series) loop
    v_type := v_item->>'type';
    v_reset := v_item->>'reset';
    v_start := (v_item->>'start')::integer;
    insert into public.cdilv_document_number_series (doc_type, format, pad, reset_period, updated_by, updated_at)
    values (v_type, v_item->>'format', (v_item->>'pad')::smallint, v_reset, p_actor_id, now())
    on conflict (doc_type) do update
    set format = excluded.format,
        pad = excluded.pad,
        reset_period = excluded.reset_period,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
    update public.cdilv_document_number_counters
    set start_value = v_start, updated_at = now()
    where doc_type = v_type
      and period = public.cdilv_document_number_period(v_reset, p_date)
      and start_value is distinct from v_start;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.cdilv_document_number_last_issued(text, text, text, date) from public, anon, authenticated;
revoke all on function public.cdilv_document_number_state(text[], date) from public, anon, authenticated;
revoke all on function public.cdilv_document_number_preview(text, date) from public, anon, authenticated;
revoke all on function public.cdilv_document_issue(uuid, date, text, uuid, text) from public, anon, authenticated;
revoke all on function public.cdilv_document_number_configure(jsonb, date, uuid) from public, anon, authenticated;
grant execute on function public.cdilv_document_number_last_issued(text, text, text, date) to service_role;
grant execute on function public.cdilv_document_number_state(text[], date) to service_role;
grant execute on function public.cdilv_document_number_preview(text, date) to service_role;
grant execute on function public.cdilv_document_issue(uuid, date, text, uuid, text) to service_role;
grant execute on function public.cdilv_document_number_configure(jsonb, date, uuid) to service_role;

commit;

notify pgrst, 'reload schema';
