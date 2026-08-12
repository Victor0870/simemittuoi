-- Si Mê Mít Tươi — schema Phase B
-- Chạy trong Supabase SQL Editor hoặc: node scripts/apply-schema.mjs

create extension if not exists "pgcrypto";

-- Profiles (đoàn viên)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  department text,
  role text not null default 'user' check (role in ('user', 'admin')),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Bài viết / thông báo
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  tag text,
  tag_tone text not null default 'primary' check (tag_tone in ('primary', 'error')),
  image_url text,
  author_id uuid references public.profiles(id),
  published_at timestamptz not null default now()
);

-- Hoạt động có điểm
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  event_date date,
  points integer not null default 0,
  image_url text,
  image_alt text,
  created_at timestamptz not null default now()
);

-- Lịch sử cộng điểm
create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid references public.activities(id),
  points integer not null,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- View tổng điểm + hạng
create or replace view public.leaderboard as
select
  p.id,
  p.full_name,
  p.department,
  p.avatar_url,
  coalesce(sum(se.points), 0)::integer as total_score,
  rank() over (order by coalesce(sum(se.points), 0) desc) as rank
from public.profiles p
left join public.score_events se on se.user_id = p.id
group by p.id, p.full_name, p.department, p.avatar_url;

-- Trigger tạo profile khi user đăng ký
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.activities enable row level security;
alter table public.score_events enable row level security;

-- Đọc công khai (trang chủ chưa cần đăng nhập)
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles for select using (true);

drop policy if exists "posts_public_read" on public.posts;
create policy "posts_public_read" on public.posts for select using (true);

drop policy if exists "activities_public_read" on public.activities;
create policy "activities_public_read" on public.activities for select using (true);

drop policy if exists "score_events_public_read" on public.score_events;
create policy "score_events_public_read" on public.score_events for select using (true);

-- Admin ghi (sau này gán role admin trong profiles)
drop policy if exists "posts_admin_write" on public.posts;
create policy "posts_admin_write" on public.posts for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "activities_admin_write" on public.activities;
create policy "activities_admin_write" on public.activities for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "score_events_admin_write" on public.score_events;
create policy "score_events_admin_write" on public.score_events for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Seed dữ liệu mẫu (chỉ khi bảng trống)
insert into public.posts (title, content, tag, tag_tone, published_at)
select * from (values
  (
    'Cập nhật Quy định Bảo hiểm 2024',
    'Các thay đổi quan trọng về mức đóng bảo hiểm y tế đã được thông qua bởi Công đoàn...',
    'Khẩn cấp',
    'error',
    now() - interval '2 hours'
  ),
  (
    'Đề cử Đại diện Công đoàn cơ sở',
    'Hãy tham gia đề cử những gương mặt ưu tú cho nhiệm kỳ 2024-2026 ngay hôm nay.',
    'Bầu cử',
    'primary',
    now() - interval '1 day'
  )
) as v(title, content, tag, tag_tone, published_at)
where not exists (select 1 from public.posts limit 1);

insert into public.activities (title, location, event_date, points, image_url, image_alt)
select * from (values
  (
    'Chạy bộ từ thiện 2024',
    'Công viên Thống Nhất',
    '2024-10-15'::date,
    200,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA1wtWPeBzDu-EUS2f282aGUtU1Cs8yvh_CmoJxECbnLCW4Y60CrP6n6A9D7GWDr1Iz4OvYwKg_b42Drz3wftnkmOejNefM93xMzUrx5lFypDcM6liWObAw1UpOqV9IqdPuaZ6NwFDTW8Pgh-Fsev91XsXzi-gYjUeinSUip3DMwyla0ljB-jfwJg-mRSqiMox6PvNQTuTa63f7kIKHsEQ3bxzCJcbfOMGEzXW1gsRwxd9HACCmlX56pUEWicYzQuT1s5VMzJw_RHQ',
    'Nhóm nhân viên tham gia chạy bộ từ thiện ngoài trời'
  ),
  (
    'Hội thảo Kỹ năng Đàm phán',
    'Phòng họp lớn 2',
    '2024-10-20'::date,
    150,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA2-cOA603njhNtLLpGRfNnqnFQcJ56DxXnfjC4mW6S7l4wBQW125L_qE08TDTSpCSBJYSMBf7YcrKQxHze-fOCzUn2OdkUaNq4BlTEKgxh4nF7KKDqZ4TdpAjL5dT68notDgK-dISYhIqB1pF0808xrlXmXmkjeaXBw8deTTd3KCtNPX9xE1Qu-5CgDAxWjRk9nsF7r2ECgVfXiE4mds67_clREFSVGslTNgMc_XZlIWr17nitcJ1Wjb7c4QSoj8fMeokS8RKFLPA',
    'Hội thảo kỹ năng trong phòng họp hiện đại'
  )
) as v(title, location, event_date, points, image_url, image_alt)
where not exists (select 1 from public.activities limit 1);

-- Quyền đọc qua Data API
grant usage on schema public to anon, authenticated;
grant select on public.posts to anon, authenticated;
grant select on public.activities to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.score_events to anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
