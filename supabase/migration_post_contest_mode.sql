-- Chế độ bài viết cuộc thi (nhận bài dự thi qua bình luận).
-- Mặc định tắt (is_contest = false) cho mọi bài viết thường;
-- chỉ bật cho bài phát động Cuộc thi Sáng tạo Logo chính thức website CDILV.VN (id = 23bf3533-8cea-4482-8475-8251a636f90e).

alter table public.cdilv_posts
  add column if not exists is_contest boolean not null default false,
  add column if not exists contest_prompt text;

update public.cdilv_posts
set is_contest = true,
    contest_prompt = 'Viết lời bình luận, ý kiến đóng góp hoặc thuyết minh ý nghĩa mẫu thiết kế Logo... (+1đ thi đua)'
where id = '23bf3533-8cea-4482-8475-8251a636f90e'
  and title = 'Phát động cuộc thi: Sáng tạo Logo chính thức website CDILV.VN';

create or replace function public.cdilv_trg_notify_admin_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_name text;
  v_post_title text;
  v_is_contest boolean := false;
  v_short_content text;
  v_short_post text;
  v_root_author uuid;
begin
  select coalesce(nullif(trim(full_name), ''), 'Một đoàn viên')
  into v_author_name
  from public.cdilv_profiles
  where id = new.user_id;
  v_author_name := coalesce(v_author_name, 'Một đoàn viên');

  select title, coalesce(is_contest, false)
  into v_post_title, v_is_contest
  from public.cdilv_posts
  where id = new.post_id;

  v_short_post := coalesce(v_post_title, 'Bài viết');
  if length(v_short_post) > 40 then
    v_short_post := substring(v_short_post from 1 for 40) || '...';
  end if;

  v_short_content := regexp_replace(new.content, '\[Ảnh[^\]\r\n]*\]:\s*\S+', '', 'gi');
  v_short_content := trim(regexp_replace(v_short_content, '\s+', ' ', 'g'));
  if v_short_content = '' or v_short_content is null then
    v_short_content := case
      when v_is_contest then 'Đã gửi một ảnh tác phẩm đính kèm'
      else 'Đã gửi một ảnh đính kèm'
    end;
  elsif length(v_short_content) > 60 then
    v_short_content := substring(v_short_content from 1 for 60) || '...';
  end if;

  if new.parent_id is not null then
    select user_id into v_root_author from public.cdilv_post_comments where id = new.parent_id;

    insert into public.cdilv_notifications (user_id, type, title, message, link)
    select distinct t.uid,
      'comment_reply',
      case when t.uid = new.reply_to_user_id
        then v_author_name || ' đã trả lời bình luận của bạn 💬'
        else v_author_name || ' đã phản hồi trong bình luận của bạn 💬'
      end,
      '"' || v_short_content || '" tại bài viết "' || v_short_post || '"',
      '/posts/' || new.post_id || '#comments'
    from (values (new.reply_to_user_id), (v_root_author)) as t(uid)
    where t.uid is not null and t.uid <> new.user_id;

    return new;
  end if;

  insert into public.cdilv_notifications (user_id, type, title, message, link)
  select
    p.id,
    'new_comment',
    v_author_name || ' đã bình luận bài viết 💬',
    '"' || v_short_content || '" tại bài viết "' || v_short_post || '"',
    '/posts/' || new.post_id
  from public.cdilv_profiles p
  where p.role = 'admin'
    and p.approval_status = 'approved'
    and p.id <> new.user_id;

  return new;
end;
$$;

notify pgrst, 'reload schema';
