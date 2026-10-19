alter table public.cdilv_polls
  add column if not exists entry_reward_points integer not null default 0;
