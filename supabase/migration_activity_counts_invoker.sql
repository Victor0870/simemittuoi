-- Security Advisor: view public.cdilv_activity_participant_counts bị báo SECURITY DEFINER (lint 0010).
-- View chuyển sang security_invoker (chạy theo quyền người truy vấn) và lấy số liệu từ hàm
-- security definer cdilv_get_activity_participant_counts có sẵn (migration_homepage_security.sql),
-- nên khách / đoàn viên vẫn thấy số người đăng ký mà không đọc được dòng cdilv_activity_registrations.
-- Tên view và cột giữ nguyên, code web không phải đổi. Chỉ cấp SELECT cho view.

begin;

create or replace view public.cdilv_activity_participant_counts
with (security_invoker = true)
as
  select c.activity_id, c.participant_count
  from public.cdilv_get_activity_participant_counts(null) as c;

alter view public.cdilv_activity_participant_counts set (security_invoker = true);

revoke all on public.cdilv_activity_participant_counts from public, anon, authenticated, service_role;
grant select on public.cdilv_activity_participant_counts to anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';
