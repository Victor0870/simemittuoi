-- Siết bảo mật theo Supabase Security Advisor (r144).
begin;

-- 1) Phiếu bình chọn / dự đoán: chỉ ghi/đọc qua API (service role).
drop policy if exists cdilv_poll_votes_insert on public.cdilv_poll_votes;
drop policy if exists cdilv_poll_votes_delete on public.cdilv_poll_votes;
drop policy if exists cdilv_poll_votes_public_read on public.cdilv_poll_votes;
drop policy if exists cdilv_poll_predictions_insert on public.cdilv_poll_predictions;
drop policy if exists cdilv_poll_predictions_public_read on public.cdilv_poll_predictions;
revoke all on public.cdilv_poll_votes from anon, authenticated;
revoke all on public.cdilv_poll_predictions from anon, authenticated;

-- 2) Hàm SECURITY DEFINER nội bộ: không cho client gọi qua /rest/v1/rpc.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'cdilv_award_comment_score(uuid)',
    'cdilv_award_poll_vote_score(uuid,uuid)',
    'cdilv_revoke_comment_score(uuid)',
    'cdilv_transfer_employee_scores(uuid,text)',
    'cdilv_refresh_leaderboard_cache()',
    'cdilv_handle_new_user()',
    'cdilv_guard_life_event_logs()',
    'cdilv_guard_member_change_logs()',
    'cdilv_guard_sensitive_access_logs()',
    'cdilv_trg_album_comment_reply_guard()',
    'cdilv_trg_cleanup_post_notifications()',
    'cdilv_trg_life_event_after_insert()',
    'cdilv_trg_life_event_before_insert()',
    'cdilv_trg_notify_admin_comment()',
    'cdilv_trg_notify_album_comment_reaction()',
    'cdilv_trg_notify_album_new_photo()',
    'cdilv_trg_notify_album_photo_comment()',
    'cdilv_trg_notify_album_photo_reaction()',
    'cdilv_trg_notify_comment_reaction()',
    'cdilv_trg_notify_new_album()',
    'cdilv_trg_notify_new_post()',
    'cdilv_trg_notify_user_approved()',
    'cdilv_trg_post_comment_reply_guard()',
    'cdilv_trg_refresh_leaderboard_cache()',
    'cdilv_trg_revoke_album_score()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end $$;

revoke execute on function public.cdilv_update_my_avatar(text) from public, anon;
grant execute on function public.cdilv_update_my_avatar(text) to authenticated, service_role;

-- 3) search_path cố định cho trigger chặn sửa log.
alter function public.cdilv_guard_life_event_logs() set search_path = public;
alter function public.cdilv_guard_member_change_logs() set search_path = public;
alter function public.cdilv_guard_sensitive_access_logs() set search_path = public;

-- 4) View bảng xếp hạng chạy theo quyền người gọi (cache đã có policy đọc công khai).
alter view public.cdilv_leaderboard set (security_invoker = on);

-- 5) Profile: người dùng chỉ được UPDATE các cột duyệt (admin, qua RLS) và avatar.
revoke update on public.cdilv_profiles from anon, authenticated;
grant update (approval_status, approved_at, approved_by, avatar_url) on public.cdilv_profiles to authenticated;

-- 6) Bỏ quyền TRUNCATE / TRIGGER / REFERENCES thừa trên các bảng cdilv.
do $$
declare
  t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'cdilv\_%'
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;
