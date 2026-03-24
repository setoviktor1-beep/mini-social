alter table public.posts
  add column if not exists edited_at timestamptz;
