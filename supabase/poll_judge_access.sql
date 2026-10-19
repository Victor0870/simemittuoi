-- Link riêng cho ban giám khảo chưa có tài khoản.
-- Bảng không có policy đọc công khai: anon/authenticated không xem được token.
-- Service role (API server) bỏ qua RLS.

create table if not exists public.cdilv_poll_judge_access (
  poll_id uuid primary key references public.cdilv_polls(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists cdilv_poll_judge_access_token_idx
  on public.cdilv_poll_judge_access (token);

alter table public.cdilv_poll_judge_access enable row level security;

revoke all on table public.cdilv_poll_judge_access from anon, authenticated;
grant select, insert, update, delete on table public.cdilv_poll_judge_access to service_role;

insert into public.cdilv_poll_judge_access (poll_id, token)
select p.id, gen_random_uuid()::text
from public.cdilv_polls p
where not exists (
  select 1 from public.cdilv_poll_judge_access a where a.poll_id = p.id
);
