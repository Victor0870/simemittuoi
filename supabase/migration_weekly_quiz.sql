-- Thi trắc nghiệm hàng tuần CDILV: ngân hàng câu hỏi, cài đặt lịch, đợt thi và lượt làm bài.
-- Chạy trên project dùng chung (BizMate) — node scripts/apply-weekly-quiz.mjs
-- Đáp án đúng chỉ đọc được bởi Admin; người chơi làm bài qua API (service role).

create table if not exists public.cdilv_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  content text not null check (length(trim(content)) between 1 and 1000),
  option_1 text not null check (length(trim(option_1)) between 1 and 300),
  option_2 text not null check (length(trim(option_2)) between 1 and 300),
  option_3 text not null check (length(trim(option_3)) between 1 and 300),
  option_4 text not null check (length(trim(option_4)) between 1 and 300),
  correct_option smallint not null check (correct_option between 1 and 4),
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cdilv_quiz_questions_created_idx
  on public.cdilv_quiz_questions (created_at);

-- Một dòng cài đặt duy nhất (id = 1). Mẫu bài viết null = dùng mẫu mặc định trong code.
create table if not exists public.cdilv_quiz_settings (
  id smallint primary key default 1 check (id = 1),
  schedule_mode text not null default 'auto' check (schedule_mode in ('auto', 'manual')),
  schedule_weekday smallint not null default 1 check (schedule_weekday between 0 and 6),
  start_time text not null default '21:00'
    check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null default '22:00'
    check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  questions_per_attempt smallint not null default 5 check (questions_per_attempt between 1 and 20),
  max_attempts smallint not null default 5 check (max_attempts between 1 and 20),
  time_limit_seconds integer not null default 120 check (time_limit_seconds between 10 and 1800),
  base_points integer not null default 5 check (base_points between 0 and 100),
  top1_bonus integer not null default 5 check (top1_bonus between 0 and 100),
  top2_5_bonus integer not null default 3 check (top2_5_bonus between 0 and 100),
  top6_10_bonus integer not null default 1 check (top6_10_bonus between 0 and 100),
  auto_finalize boolean not null default true,
  result_post_title text,
  result_post_template text,
  result_post_publish boolean not null default true,
  updated_by uuid references public.cdilv_profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.cdilv_quiz_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.cdilv_quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  title text not null,
  mode text not null check (mode in ('auto', 'manual')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  finalized_at timestamptz,
  result_post_id uuid references public.cdilv_posts(id) on delete set null,
  participants_count integer,
  winners_count integer,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists cdilv_quiz_sessions_window_idx
  on public.cdilv_quiz_sessions (starts_at desc, ends_at);

create table if not exists public.cdilv_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cdilv_quiz_sessions(id) on delete cascade,
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  attempt_no smallint not null check (attempt_no >= 1),
  question_ids uuid[] not null,
  correct_options smallint[] not null,
  answers smallint[],
  total_questions smallint not null,
  correct_count smallint,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'expired')),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  duration_ms integer,
  unique (session_id, user_id, attempt_no)
);

create index if not exists cdilv_quiz_attempts_session_idx
  on public.cdilv_quiz_attempts (session_id, status);

-- ---------------------------------------------------------------------------
-- Quyền: chỉ Admin đọc câu hỏi và lượt làm bài; ghi đi qua API (service role).
-- ---------------------------------------------------------------------------
alter table public.cdilv_quiz_questions enable row level security;
alter table public.cdilv_quiz_settings enable row level security;
alter table public.cdilv_quiz_sessions enable row level security;
alter table public.cdilv_quiz_attempts enable row level security;

drop policy if exists "cdilv_quiz_questions_admin_read" on public.cdilv_quiz_questions;
create policy "cdilv_quiz_questions_admin_read" on public.cdilv_quiz_questions
  for select to authenticated using (
    exists (
      select 1 from public.cdilv_profiles
      where id = auth.uid() and role = 'admin' and approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_quiz_attempts_admin_read" on public.cdilv_quiz_attempts;
create policy "cdilv_quiz_attempts_admin_read" on public.cdilv_quiz_attempts
  for select to authenticated using (
    exists (
      select 1 from public.cdilv_profiles
      where id = auth.uid() and role = 'admin' and approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_quiz_settings_member_read" on public.cdilv_quiz_settings;
create policy "cdilv_quiz_settings_member_read" on public.cdilv_quiz_settings
  for select to authenticated using (true);

drop policy if exists "cdilv_quiz_sessions_member_read" on public.cdilv_quiz_sessions;
create policy "cdilv_quiz_sessions_member_read" on public.cdilv_quiz_sessions
  for select to authenticated using (true);

revoke all on public.cdilv_quiz_questions, public.cdilv_quiz_settings,
  public.cdilv_quiz_sessions, public.cdilv_quiz_attempts from anon;
grant select on public.cdilv_quiz_questions, public.cdilv_quiz_settings,
  public.cdilv_quiz_sessions, public.cdilv_quiz_attempts to authenticated;
grant all on public.cdilv_quiz_questions, public.cdilv_quiz_settings,
  public.cdilv_quiz_sessions, public.cdilv_quiz_attempts to service_role;

notify pgrst, 'reload schema';
