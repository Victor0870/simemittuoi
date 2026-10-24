-- Nhiều chương trình thi trắc nghiệm (giống Bình chọn): mỗi chương trình có cài đặt, đợt thi,
-- ngân hàng câu hỏi, lượt làm bài và bảng xếp hạng riêng.
-- Toàn bộ dữ liệu hiện có được gắn vào chương trình "Trắc nghiệm tuần" (id cố định, trùng
-- WEEKLY_QUIZ_PROGRAM_ID trong src/lib/quiz-shared.ts). Không sửa / xóa dữ liệu cũ; điểm giữ nguyên.

begin;

create table if not exists public.cdilv_quiz_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 150),
  description text check (description is null or length(description) <= 2000),
  is_active boolean not null default true,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.cdilv_quiz_programs (id, name, description, is_active, created_at)
values (
  '3f0e9a4c-2b1d-4c7e-8a5f-6d2b1c0e7a01',
  'Trắc nghiệm tuần',
  'Thi trắc nghiệm hàng tuần: ngân hàng câu hỏi, lịch mở thi, tổng kết cộng điểm và bài viết kết quả.',
  true,
  least(
    (select min(created_at) from public.cdilv_quiz_questions),
    (select min(created_at) from public.cdilv_quiz_sessions),
    now()
  )
)
on conflict (id) do nothing;

-- Cài đặt: một dòng cho mỗi chương trình (bỏ ràng buộc id = 1, id tự tăng cho chương trình mới).
alter table public.cdilv_quiz_settings
  add column if not exists program_id uuid not null default '3f0e9a4c-2b1d-4c7e-8a5f-6d2b1c0e7a01'
    references public.cdilv_quiz_programs(id) on delete cascade;
create unique index if not exists cdilv_quiz_settings_program_key
  on public.cdilv_quiz_settings (program_id);
alter table public.cdilv_quiz_settings drop constraint if exists cdilv_quiz_settings_id_check;
create sequence if not exists public.cdilv_quiz_settings_id_seq as smallint
  owned by public.cdilv_quiz_settings.id;
select setval(
  'public.cdilv_quiz_settings_id_seq',
  greatest((select max(id) from public.cdilv_quiz_settings), 1)
);
alter table public.cdilv_quiz_settings
  alter column id set default nextval('public.cdilv_quiz_settings_id_seq');

-- Ngân hàng câu hỏi theo chương trình.
alter table public.cdilv_quiz_questions
  add column if not exists program_id uuid not null default '3f0e9a4c-2b1d-4c7e-8a5f-6d2b1c0e7a01'
    references public.cdilv_quiz_programs(id) on delete restrict;
create index if not exists cdilv_quiz_questions_program_idx
  on public.cdilv_quiz_questions (program_id, created_at);

-- Đợt thi theo chương trình: mã đợt (auto-YYYY-MM-DD) chỉ cần duy nhất trong một chương trình.
alter table public.cdilv_quiz_sessions
  add column if not exists program_id uuid not null default '3f0e9a4c-2b1d-4c7e-8a5f-6d2b1c0e7a01'
    references public.cdilv_quiz_programs(id) on delete restrict;
alter table public.cdilv_quiz_sessions drop constraint if exists cdilv_quiz_sessions_session_key_key;
alter table public.cdilv_quiz_sessions drop constraint if exists cdilv_quiz_sessions_program_session_key_key;
alter table public.cdilv_quiz_sessions
  add constraint cdilv_quiz_sessions_program_session_key_key unique (program_id, session_key);
alter table public.cdilv_quiz_sessions drop constraint if exists cdilv_quiz_sessions_id_program_key;
alter table public.cdilv_quiz_sessions
  add constraint cdilv_quiz_sessions_id_program_key unique (id, program_id);
create index if not exists cdilv_quiz_sessions_program_window_idx
  on public.cdilv_quiz_sessions (program_id, starts_at desc, ends_at);

-- Lượt làm bài theo chương trình; khóa ngoại kép bảo đảm trùng chương trình với đợt thi.
alter table public.cdilv_quiz_attempts
  add column if not exists program_id uuid not null default '3f0e9a4c-2b1d-4c7e-8a5f-6d2b1c0e7a01';
update public.cdilv_quiz_attempts a
  set program_id = s.program_id
  from public.cdilv_quiz_sessions s
  where s.id = a.session_id and a.program_id is distinct from s.program_id;
alter table public.cdilv_quiz_attempts drop constraint if exists cdilv_quiz_attempts_session_program_fkey;
alter table public.cdilv_quiz_attempts
  add constraint cdilv_quiz_attempts_session_program_fkey
    foreign key (session_id, program_id)
    references public.cdilv_quiz_sessions (id, program_id) on delete cascade;
create index if not exists cdilv_quiz_attempts_program_idx
  on public.cdilv_quiz_attempts (program_id, session_id);

-- Quyền: thành viên đã đăng nhập đọc danh sách chương trình; ghi qua API (service role).
alter table public.cdilv_quiz_programs enable row level security;

drop policy if exists "cdilv_quiz_programs_member_read" on public.cdilv_quiz_programs;
create policy "cdilv_quiz_programs_member_read" on public.cdilv_quiz_programs
  for select to authenticated using (true);

revoke all on public.cdilv_quiz_programs from anon;
grant select on public.cdilv_quiz_programs to authenticated;
grant all on public.cdilv_quiz_programs to service_role;
grant usage, select on sequence public.cdilv_quiz_settings_id_seq to service_role;

commit;

notify pgrst, 'reload schema';
