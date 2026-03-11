begin;

create table if not exists public.internal_social_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  author_avatar_url text null,
  audience_type text not null check (audience_type in ('company', 'project')),
  audience_project_id uuid null references public.projects(id) on delete cascade,
  audience_label text not null,
  text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.internal_social_post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.internal_social_posts(id) on delete cascade,
  type text not null check (type in ('image', 'video', 'link')),
  url text not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.internal_social_posts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_social_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.internal_social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create table if not exists public.internal_social_direct_messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  from_name text not null,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_social_posts_created
  on public.internal_social_posts(created_at desc);

create index if not exists idx_internal_social_posts_audience_project
  on public.internal_social_posts(audience_project_id, created_at desc);

create index if not exists idx_internal_social_comments_post
  on public.internal_social_post_comments(post_id, created_at asc);

create index if not exists idx_internal_social_reactions_post
  on public.internal_social_post_reactions(post_id, created_at desc);

create index if not exists idx_internal_social_direct_messages_users
  on public.internal_social_direct_messages(from_user_id, to_user_id, created_at asc);

alter table public.internal_social_posts enable row level security;
alter table public.internal_social_post_attachments enable row level security;
alter table public.internal_social_post_comments enable row level security;
alter table public.internal_social_post_reactions enable row level security;
alter table public.internal_social_direct_messages enable row level security;

drop policy if exists internal_social_posts_select_auth on public.internal_social_posts;
create policy internal_social_posts_select_auth
on public.internal_social_posts
for select
to authenticated
using (
  audience_type = 'company'
  or (
    audience_type = 'project'
    and audience_project_id is not null
    and exists (
      select 1
      from public.project_members pm
      where pm.project_id = audience_project_id
        and pm.user_id = auth.uid()
    )
  )
  or public.current_role() in ('admin', 'diretoria')
);

drop policy if exists internal_social_posts_insert_auth on public.internal_social_posts;
create policy internal_social_posts_insert_auth
on public.internal_social_posts
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and (
    audience_type = 'company'
    or (
      audience_type = 'project'
      and audience_project_id is not null
      and exists (
        select 1
        from public.project_members pm
        where pm.project_id = audience_project_id
          and pm.user_id = auth.uid()
      )
    )
    or public.current_role() in ('admin', 'diretoria')
  )
);

drop policy if exists internal_social_posts_delete_own on public.internal_social_posts;
create policy internal_social_posts_delete_own
on public.internal_social_posts
for delete
to authenticated
using (
  author_user_id = auth.uid()
  or public.current_role() in ('admin', 'diretoria')
);

drop policy if exists internal_social_post_attachments_select_auth on public.internal_social_post_attachments;
create policy internal_social_post_attachments_select_auth
on public.internal_social_post_attachments
for select
to authenticated
using (
  exists (
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

drop policy if exists internal_social_post_attachments_insert_auth on public.internal_social_post_attachments;
create policy internal_social_post_attachments_insert_auth
on public.internal_social_post_attachments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.internal_social_posts p
    where p.id = post_id
      and p.author_user_id = auth.uid()
  )
);

drop policy if exists internal_social_post_comments_select_auth on public.internal_social_post_comments;
create policy internal_social_post_comments_select_auth
on public.internal_social_post_comments
for select
to authenticated
using (
  exists (
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

drop policy if exists internal_social_post_comments_insert_auth on public.internal_social_post_comments;
create policy internal_social_post_comments_insert_auth
on public.internal_social_post_comments
for insert
to authenticated
with check (
  author_user_id = auth.uid()
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

drop policy if exists internal_social_post_reactions_select_auth on public.internal_social_post_reactions;
create policy internal_social_post_reactions_select_auth
on public.internal_social_post_reactions
for select
to authenticated
using (
  exists (
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

drop policy if exists internal_social_post_reactions_insert_auth on public.internal_social_post_reactions;
create policy internal_social_post_reactions_insert_auth
on public.internal_social_post_reactions
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

drop policy if exists internal_social_post_reactions_delete_own on public.internal_social_post_reactions;
create policy internal_social_post_reactions_delete_own
on public.internal_social_post_reactions
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists internal_social_direct_messages_select_auth on public.internal_social_direct_messages;
create policy internal_social_direct_messages_select_auth
on public.internal_social_direct_messages
for select
to authenticated
using (
  from_user_id = auth.uid()
  or to_user_id = auth.uid()
  or public.current_role() in ('admin', 'diretoria')
);

drop policy if exists internal_social_direct_messages_insert_auth on public.internal_social_direct_messages;
create policy internal_social_direct_messages_insert_auth
on public.internal_social_direct_messages
for insert
to authenticated
with check (
  from_user_id = auth.uid()
);

commit;
