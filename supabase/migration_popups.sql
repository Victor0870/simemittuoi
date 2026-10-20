-- =============================================================================
-- Popup thông báo nhanh (tin gấp, nội dung ngắn)
-- - Người có quyền popups.manage tạo / sửa / bật tắt popup, hẹn giờ hiện và hết hạn.
-- - Mọi truy cập đi qua API máy chủ (service role): RLS bật, không mở policy cho
--   anon/authenticated.
-- - cdilv_popup_views: ai đã xem popup nào (đếm lượt xem, "chỉ hiện 1 lần" trên mọi thiết bị).
-- Chạy: node scripts/apply-popups.mjs
-- =============================================================================

create table if not exists public.cdilv_popups (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  tone text not null default 'info' check (tone in ('info', 'urgent', 'warning', 'success')),
  link_url text check (link_url is null or char_length(link_url) <= 500),
  link_label text check (link_label is null or char_length(link_label) <= 40),
  -- members: chỉ đoàn viên đã duyệt; all: cả khách chưa đăng nhập
  audience text not null default 'members' check (audience in ('members', 'all')),
  -- once: 1 lần / người; daily: mỗi ngày 1 lần; session: mỗi lần mở trình duyệt
  frequency text not null default 'once' check (frequency in ('once', 'daily', 'session')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.cdilv_profiles(id) on delete set null,
  updated_by uuid references public.cdilv_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cdilv_popups_time_range check (ends_at is null or ends_at > starts_at)
);

create index if not exists cdilv_popups_active_idx
  on public.cdilv_popups (is_active, starts_at, ends_at);

create table if not exists public.cdilv_popup_views (
  popup_id uuid not null references public.cdilv_popups(id) on delete cascade,
  user_id uuid not null references public.cdilv_profiles(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 1,
  primary key (popup_id, user_id)
);

create index if not exists cdilv_popup_views_user_idx
  on public.cdilv_popup_views (user_id);

create or replace function public.cdilv_mark_popup_seen(p_popup_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.cdilv_popup_views (popup_id, user_id)
  values (p_popup_id, p_user_id)
  on conflict (popup_id, user_id)
  do update set last_seen_at = now(),
                seen_count = public.cdilv_popup_views.seen_count + 1;
$$;

alter table public.cdilv_popups enable row level security;
alter table public.cdilv_popup_views enable row level security;

revoke all on public.cdilv_popups, public.cdilv_popup_views from anon, authenticated;
grant select, insert, update, delete on public.cdilv_popups, public.cdilv_popup_views to service_role;

revoke all on function public.cdilv_mark_popup_seen(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cdilv_mark_popup_seen(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
