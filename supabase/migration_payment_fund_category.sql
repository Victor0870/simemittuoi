-- =============================================================================
-- Đề nghị thanh toán: người duyệt chọn danh mục chi khi duyệt.
-- - fund_category_id: danh mục chi (cdilv_fund_categories, loại expense) dùng khi tự ghi phiếu chi
--   lúc xác nhận "Đã chi". null = đề nghị cũ → giữ cách cũ (Chi thăm hỏi nếu toàn phiếu thăm hỏi,
--   còn lại Chi hoạt động phong trào khác).
-- - cdilv_payment_request_approve: ghi danh mục + chuyển "Đã duyệt" trong cùng một giao dịch.
-- - Không đổi dữ liệu cũ. Chạy lại an toàn.
-- =============================================================================

alter table public.cdilv_payment_requests
  add column if not exists fund_category_id uuid references public.cdilv_fund_categories(id) on delete set null;

create or replace function public.cdilv_payment_request_approve(
  p_request_id uuid,
  p_actor_id uuid,
  p_category_id uuid,
  p_note text default null
)
returns public.cdilv_payment_requests
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.cdilv_fund_categories
    where id = p_category_id and kind = 'expense' and is_active
  ) then
    raise exception 'Danh mục chi không hợp lệ hoặc đã ẩn.' using errcode = 'P0001';
  end if;

  update public.cdilv_payment_requests
  set fund_category_id = p_category_id
  where id = p_request_id and status = 'proposed';
  if not found then
    raise exception 'Chỉ duyệt được đề nghị đang chờ duyệt.' using errcode = 'P0001';
  end if;

  return public.cdilv_payment_request_transition(p_request_id, p_actor_id, 'approved', p_note);
end;
$$;

-- Tự ghi phiếu chi khi "Đã chi": ưu tiên danh mục người duyệt đã chọn.
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

  if new.fund_category_id is not null then
    select id into v_category
    from public.cdilv_fund_categories
    where id = new.fund_category_id and kind = 'expense';
  end if;

  if v_category is null then
    select bool_and(visit_request_id is not null) into v_all_visits
    from public.cdilv_payment_request_items where request_id = new.id;

    select id into v_category
    from public.cdilv_fund_categories
    where system_key = case when coalesce(v_all_visits, false) then 'visit' else 'payment_default' end and is_active;
    if v_category is null then
      select id into v_category
      from public.cdilv_fund_categories where system_key = 'payment_default';
    end if;
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

revoke all on function public.cdilv_payment_request_approve(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cdilv_payment_request_approve(uuid, uuid, uuid, text) to service_role;
revoke all on function public.cdilv_trg_payment_request_paid_to_fund() from public, anon, authenticated;

notify pgrst, 'reload schema';
