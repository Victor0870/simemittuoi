-- Bình chọn free: người chưa là đoàn viên gắn phiếu với mã nhân viên.
-- Mã trùng thì lần bình chọn sau thay phiếu cũ (API xóa phiếu cũ rồi ghi phiếu mới).

alter table public.cdilv_poll_votes
  add column if not exists employee_code text;

create index if not exists cdilv_poll_votes_poll_employee_idx
  on public.cdilv_poll_votes (poll_id, employee_code)
  where employee_code is not null;

drop policy if exists "cdilv_poll_votes_delete" on public.cdilv_poll_votes;
create policy "cdilv_poll_votes_delete" on public.cdilv_poll_votes
  for delete using (true);

grant select, insert, update, delete on public.cdilv_poll_votes to anon, authenticated, service_role;

notify pgrst, 'reload schema';
