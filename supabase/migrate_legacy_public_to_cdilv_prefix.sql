-- =============================================================================
-- Đổi tên bảng/RPC project CDILV RIÊNG (qpaoucyjitbmfcahxrqu) sang prefix cdilv_*
-- để khớp code hiện tại — chạy TRƯỚC khi chuyển dữ liệu sang project BizMate.
-- KHÔNG chạy file này trên project BizMate (đã có public.profiles của POS).
-- =============================================================================

-- Đổi tên bảng (bỏ qua nếu đã đổi)
do $$
begin
  if to_regclass('public.profiles') is not null
     and to_regclass('public.cdilv_profiles') is null then
    alter table public.profiles rename to cdilv_profiles;
  end if;
  if to_regclass('public.posts') is not null
     and to_regclass('public.cdilv_posts') is null then
    alter table public.posts rename to cdilv_posts;
  end if;
  if to_regclass('public.activities') is not null
     and to_regclass('public.cdilv_activities') is null then
    alter table public.activities rename to cdilv_activities;
  end if;
  if to_regclass('public.score_events') is not null
     and to_regclass('public.cdilv_score_events') is null then
    alter table public.score_events rename to cdilv_score_events;
  end if;
  if to_regclass('public.employee_whitelist') is not null
     and to_regclass('public.cdilv_employee_whitelist') is null then
    alter table public.employee_whitelist rename to cdilv_employee_whitelist;
  end if;
  if to_regclass('public.employee_score_events') is not null
     and to_regclass('public.cdilv_employee_score_events') is null then
    alter table public.employee_score_events rename to cdilv_employee_score_events;
  end if;
  if to_regclass('public.leaderboard_cache') is not null
     and to_regclass('public.cdilv_leaderboard_cache') is null then
    alter table public.leaderboard_cache rename to cdilv_leaderboard_cache;
  end if;
end $$;

drop view if exists public.leaderboard;
drop view if exists public.cdilv_leaderboard;

create view public.cdilv_leaderboard as
select
  id, full_name, department, avatar_url, employee_code,
  total_score, first_scored_at, rank
from public.cdilv_leaderboard_cache
where total_score > 0;

grant select on public.cdilv_leaderboard to anon, authenticated;

-- RPC mới (tên cdilv_*) — body trỏ bảng đã rename
-- Sau bước này nên chạy lại supabase/cdilv_on_shared_project.sql
-- (phần function/trigger/RLS) trên project này, HOẶC chuyển sang BizMate.
--
-- Gợi ý an toàn: trên project riêng chỉ rename + tạo view;
-- trên BizMate chạy full cdilv_on_shared_project.sql rồi copy data.
