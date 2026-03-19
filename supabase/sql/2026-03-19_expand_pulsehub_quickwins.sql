begin;

alter table if exists public.internal_social_posts
  add column if not exists post_type text not null default 'social';

alter table if exists public.internal_social_posts
  add column if not exists official_author_label text null;

alter table if exists public.internal_social_posts
  drop constraint if exists internal_social_posts_post_type_check;

alter table if exists public.internal_social_posts
  add constraint internal_social_posts_post_type_check
  check (post_type in ('social', 'announcement', 'campaign', 'event', 'recognition'));

create table if not exists public.internal_social_saved_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.internal_social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint internal_social_saved_posts_unique unique (post_id, user_id)
);

create index if not exists idx_internal_social_saved_posts_user_created
  on public.internal_social_saved_posts(user_id, created_at desc);

create table if not exists public.internal_social_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid null references public.internal_social_posts(id) on delete cascade,
  comment_id uuid null references public.internal_social_post_comments(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  mentioned_by_user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  created_at timestamptz not null default now(),
  constraint internal_social_mentions_target_check check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

create index if not exists idx_internal_social_mentions_user_created
  on public.internal_social_mentions(mentioned_user_id, created_at desc);

create index if not exists idx_internal_social_mentions_post
  on public.internal_social_mentions(post_id);

create index if not exists idx_internal_social_mentions_comment
  on public.internal_social_mentions(comment_id);

create table if not exists public.internal_social_hashtags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid null references public.internal_social_posts(id) on delete cascade,
  comment_id uuid null references public.internal_social_post_comments(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  constraint internal_social_hashtags_target_check check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

create index if not exists idx_internal_social_hashtags_tag_created
  on public.internal_social_hashtags(tag, created_at desc);

create index if not exists idx_internal_social_hashtags_post
  on public.internal_social_hashtags(post_id);

create index if not exists idx_internal_social_hashtags_comment
  on public.internal_social_hashtags(comment_id);

create table if not exists public.internal_social_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  kind text not null,
  entity_type text not null,
  entity_id uuid null,
  title text not null,
  body text null,
  link_url text null,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint internal_social_notifications_kind_check check (
    kind in ('comment', 'reaction', 'mention', 'message', 'announcement', 'campaign')
  ),
  constraint internal_social_notifications_entity_type_check check (
    entity_type in ('post', 'comment', 'message', 'system')
  )
);

create index if not exists idx_internal_social_notifications_user_created
  on public.internal_social_notifications(user_id, created_at desc);

create index if not exists idx_internal_social_notifications_user_read
  on public.internal_social_notifications(user_id, read_at, created_at desc);

alter table if exists public.internal_social_saved_posts enable row level security;
alter table if exists public.internal_social_mentions enable row level security;
alter table if exists public.internal_social_hashtags enable row level security;
alter table if exists public.internal_social_notifications enable row level security;

drop policy if exists internal_social_saved_posts_select_own on public.internal_social_saved_posts;
create policy internal_social_saved_posts_select_own
on public.internal_social_saved_posts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists internal_social_saved_posts_insert_own on public.internal_social_saved_posts;
create policy internal_social_saved_posts_insert_own
on public.internal_social_saved_posts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.internal_social_posts p
    where p.id = post_id
      and (
        p.audience_type = 'company'
        or (
          p.audience_type = 'project'
          and p.audience_project_id is not null
          and exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.audience_project_id
              and pm.user_id = auth.uid()
          )
        )
        or public.current_role() in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_saved_posts_delete_own on public.internal_social_saved_posts;
create policy internal_social_saved_posts_delete_own
on public.internal_social_saved_posts
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists internal_social_mentions_select_visible on public.internal_social_mentions;
create policy internal_social_mentions_select_visible
on public.internal_social_mentions
for select
to authenticated
using (
  mentioned_user_id = auth.uid()
  or public.current_role() in ('admin', 'diretoria')
);

drop policy if exists internal_social_hashtags_select_auth on public.internal_social_hashtags;
create policy internal_social_hashtags_select_auth
on public.internal_social_hashtags
for select
to authenticated
using (true);

drop policy if exists internal_social_notifications_select_own on public.internal_social_notifications;
create policy internal_social_notifications_select_own
on public.internal_social_notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists internal_social_notifications_update_own on public.internal_social_notifications;
create policy internal_social_notifications_update_own
on public.internal_social_notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists internal_social_notifications_delete_own on public.internal_social_notifications;
create policy internal_social_notifications_delete_own
on public.internal_social_notifications
for delete
to authenticated
using (user_id = auth.uid());

commit;
