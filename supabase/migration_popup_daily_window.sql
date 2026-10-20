-- =============================================================================
-- Popup: khung giờ lặp mỗi ngày (giờ Việt Nam), VD chỉ hiện 07:00–09:00 hằng ngày
-- trong khoảng starts_at → ends_at. Cả hai cột null = hiện cả ngày.
-- Chạy: node scripts/apply-popup-daily-window.mjs
-- =============================================================================

alter table public.cdilv_popups
  add column if not exists daily_start time,
  add column if not exists daily_end time;

alter table public.cdilv_popups drop constraint if exists cdilv_popups_daily_window;
alter table public.cdilv_popups add constraint cdilv_popups_daily_window check (
  (daily_start is null and daily_end is null)
  or (daily_start is not null and daily_end is not null and daily_end > daily_start)
);

notify pgrst, 'reload schema';
