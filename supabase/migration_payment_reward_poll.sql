-- Đề nghị thanh toán: dòng chi lấy từ danh sách thưởng của một chương trình bình chọn đã kết thúc.
-- Danh sách thưởng là chi tiết đi kèm của dòng chi; một chương trình chỉ nằm trong một đề nghị còn hiệu lực.
-- Chỉ thêm cột / thay hàm, không đổi dữ liệu cũ.

alter table public.cdilv_payment_request_items
  add column if not exists reward_poll_id uuid references public.cdilv_polls(id) on delete set null;

create index if not exists cdilv_payment_request_items_reward_poll_idx
  on public.cdilv_payment_request_items (reward_poll_id)
  where reward_poll_id is not null;

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

  select '“' || p.title || '” (đã nằm trong ' || r.code || ')' into v_conflict
  from jsonb_array_elements(p_items) x
  join public.cdilv_payment_request_items i on i.reward_poll_id = (x->>'reward_poll_id')::uuid
  join public.cdilv_payment_requests r on r.id = i.request_id
  join public.cdilv_polls p on p.id = i.reward_poll_id
  where x->>'reward_poll_id' is not null
    and r.status not in ('rejected', 'cancelled')
    and r.id is distinct from p_request_id
  limit 1;
  if v_conflict is not null then
    raise exception 'Danh sách thưởng % rồi.', v_conflict using errcode = 'P0001';
  end if;

  if p_request_id is null then
    insert into public.cdilv_payment_requests (
      request_date, title, requester_name, requester_department, payment_method,
      receiver_kind, receiver_member_id,
      receiver_name, receiver_account, receiver_bank, counterparty_id, note, total_amount, advanced_amount, created_by
    ) values (
      (p_header->>'request_date')::date,
      p_header->>'title',
      p_header->>'requester_name',
      nullif(p_header->>'requester_department', ''),
      coalesce(p_header->>'payment_method', 'transfer'),
      nullif(p_header->>'receiver_kind', ''),
      nullif(p_header->>'receiver_member_id', '')::uuid,
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
        receiver_kind = nullif(p_header->>'receiver_kind', ''),
        receiver_member_id = nullif(p_header->>'receiver_member_id', '')::uuid,
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

  insert into public.cdilv_payment_request_items (
    request_id, order_num, content, paid_to, amount, advanced, visit_request_id, reward_poll_id
  )
  select
    v_req.id,
    ord::integer,
    x->>'content',
    nullif(x->>'paid_to', ''),
    (x->>'amount')::bigint,
    coalesce((x->>'advanced')::bigint, 0),
    (x->>'visit_request_id')::uuid,
    nullif(x->>'reward_poll_id', '')::uuid
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

revoke all on function public.cdilv_payment_request_save(uuid, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.cdilv_payment_request_save(uuid, uuid, jsonb, jsonb, text) to service_role;
