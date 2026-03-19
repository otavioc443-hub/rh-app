begin;

alter table if exists public.internal_social_posts
  add column if not exists hidden_at timestamptz null;

alter table if exists public.internal_social_posts
  add column if not exists hidden_reason text null;

commit;
