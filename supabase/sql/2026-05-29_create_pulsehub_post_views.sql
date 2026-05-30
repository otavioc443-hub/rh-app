create table if not exists public.internal_social_post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.internal_social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists idx_internal_social_post_views_post
  on public.internal_social_post_views(post_id, viewed_at desc);

create index if not exists idx_internal_social_post_views_user
  on public.internal_social_post_views(user_id, viewed_at desc);

alter table public.internal_social_post_views enable row level security;

drop policy if exists internal_social_post_views_select_visible_post on public.internal_social_post_views;
create policy internal_social_post_views_select_visible_post
on public.internal_social_post_views
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
        or public.current_role() in ('admin', 'rh', 'diretoria')
      )
  )
);

drop policy if exists internal_social_post_views_insert_own_visible_post on public.internal_social_post_views;
create policy internal_social_post_views_insert_own_visible_post
on public.internal_social_post_views
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
        or public.current_role() in ('admin', 'rh', 'diretoria')
      )
  )
);

drop policy if exists internal_social_post_views_update_own on public.internal_social_post_views;
create policy internal_social_post_views_update_own
on public.internal_social_post_views
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
