-- Cài đặt tiền thưởng (VNĐ / người) dùng khi xuất danh sách nhận thưởng của chương trình bình chọn.
-- {"first","second","third","consolation","entry","predictor": số tiền, "entryForWinners": boolean}
alter table public.cdilv_polls
  add column if not exists reward_money jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
