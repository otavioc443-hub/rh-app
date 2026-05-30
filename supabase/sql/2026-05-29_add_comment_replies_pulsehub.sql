alter table if exists public.internal_social_post_comments
  add column if not exists parent_comment_id uuid null references public.internal_social_post_comments(id) on delete cascade;

create index if not exists idx_internal_social_comments_parent
  on public.internal_social_post_comments(parent_comment_id, created_at asc);
