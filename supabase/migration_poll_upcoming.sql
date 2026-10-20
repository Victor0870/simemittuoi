-- Trạng thái "Sắp mở" cho chương trình bình chọn:
--   status = 'upcoming'  -> hiển thị công khai, cho bình chọn THỬ (không ghi nhận).
--   opens_at             -> tự chuyển sang nhận phiếu thật khi tới giờ (null = mở bằng tay).
--   voting_ends_at       -> tự dừng nhận phiếu khi tới giờ (null = dừng khi BTC đóng & trao giải).

alter table public.cdilv_polls
  add column if not exists opens_at timestamptz,
  add column if not exists voting_ends_at timestamptz;

alter table public.cdilv_polls drop constraint if exists cdilv_polls_status_check;
alter table public.cdilv_polls
  add constraint cdilv_polls_status_check
  check (status = any (array['open'::text, 'closed'::text, 'draft'::text, 'upcoming'::text]));

alter table public.cdilv_polls drop constraint if exists cdilv_polls_voting_window;
alter table public.cdilv_polls
  add constraint cdilv_polls_voting_window
  check (opens_at is null or voting_ends_at is null or voting_ends_at > opens_at);
