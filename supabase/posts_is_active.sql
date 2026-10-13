alter table public.cdilv_posts
  add column if not exists is_active boolean not null default true;

notify pgrst, 'reload schema';
