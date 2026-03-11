begin;

alter table if exists public.internal_social_posts
  add column if not exists is_pinned boolean not null default false;

create table if not exists public.internal_social_project_boards (
  project_id uuid primary key references public.projects(id) on delete cascade,
  notes text not null default '',
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table if exists public.internal_social_project_boards enable row level security;

drop policy if exists internal_social_project_boards_select on public.internal_social_project_boards;
create policy internal_social_project_boards_select
on public.internal_social_project_boards
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        p.role in ('admin', 'diretoria')
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = internal_social_project_boards.project_id
            and pm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists internal_social_project_boards_insert on public.internal_social_project_boards;
create policy internal_social_project_boards_insert
on public.internal_social_project_boards
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        p.role in ('admin', 'diretoria')
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = internal_social_project_boards.project_id
            and pm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists internal_social_project_boards_update on public.internal_social_project_boards;
create policy internal_social_project_boards_update
on public.internal_social_project_boards
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        p.role in ('admin', 'diretoria')
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = internal_social_project_boards.project_id
            and pm.user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        p.role in ('admin', 'diretoria')
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = internal_social_project_boards.project_id
            and pm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists internal_social_posts_update_author_or_admin on public.internal_social_posts;
create policy internal_social_posts_update_author_or_admin
on public.internal_social_posts
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        internal_social_posts.author_user_id = auth.uid()
        or p.role in ('admin', 'diretoria')
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        internal_social_posts.author_user_id = auth.uid()
        or p.role in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_posts_delete_author_or_admin on public.internal_social_posts;
create policy internal_social_posts_delete_author_or_admin
on public.internal_social_posts
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        internal_social_posts.author_user_id = auth.uid()
        or p.role in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_post_comments_update_author_or_admin on public.internal_social_post_comments;
create policy internal_social_post_comments_update_author_or_admin
on public.internal_social_post_comments
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        internal_social_post_comments.author_user_id = auth.uid()
        or p.role in ('admin', 'diretoria')
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        internal_social_post_comments.author_user_id = auth.uid()
        or p.role in ('admin', 'diretoria')
      )
  )
);

drop policy if exists internal_social_post_comments_delete_author_or_admin on public.internal_social_post_comments;
create policy internal_social_post_comments_delete_author_or_admin
on public.internal_social_post_comments
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        internal_social_post_comments.author_user_id = auth.uid()
        or p.role in ('admin', 'diretoria')
      )
  )
);

commit;
