begin;

alter table if exists public.internal_social_groups
  add column if not exists cover_image_url text null,
  add column if not exists category text null,
  add column if not exists rules text null,
  add column if not exists modalities jsonb not null default '["posts","polls","campaigns"]'::jsonb,
  add column if not exists allow_member_posts boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.internal_social_community_creator_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.internal_social_community_creator_permissions enable row level security;

create or replace function public.internal_social_can_create_community(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = coalesce(p_user_id, auth.uid())
      and p.active is true
      and p.role in ('admin', 'rh')
  )
  or exists (
    select 1
    from public.internal_social_community_creator_permissions c
    where c.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

grant execute on function public.internal_social_can_create_community(uuid) to authenticated;

drop policy if exists internal_social_community_creator_permissions_select_admin on public.internal_social_community_creator_permissions;
create policy internal_social_community_creator_permissions_select_admin
on public.internal_social_community_creator_permissions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_role() in ('admin', 'rh')
);

drop policy if exists internal_social_community_creator_permissions_write_rh_admin on public.internal_social_community_creator_permissions;
create policy internal_social_community_creator_permissions_write_rh_admin
on public.internal_social_community_creator_permissions
for all
to authenticated
using (public.current_role() in ('admin', 'rh'))
with check (public.current_role() in ('admin', 'rh'));

drop policy if exists internal_social_groups_insert_admin on public.internal_social_groups;
drop policy if exists internal_social_groups_insert_creator_permission on public.internal_social_groups;
create policy internal_social_groups_insert_creator_permission
on public.internal_social_groups
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.internal_social_can_create_community(auth.uid())
);

drop policy if exists internal_social_groups_update_rh_admin_or_editor on public.internal_social_groups;
create policy internal_social_groups_update_rh_admin_or_editor
on public.internal_social_groups
for update
to authenticated
using (
  public.current_role() in ('admin', 'rh')
  or exists (
    select 1
    from public.internal_social_group_members gm
    where gm.group_id = internal_social_groups.id
      and gm.user_id = auth.uid()
      and gm.role in ('owner', 'moderator')
  )
)
with check (
  public.current_role() in ('admin', 'rh')
  or exists (
    select 1
    from public.internal_social_group_members gm
    where gm.group_id = internal_social_groups.id
      and gm.user_id = auth.uid()
      and gm.role in ('owner', 'moderator')
  )
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
    or (
      audience_type = 'group'
      and audience_group_id is not null
      and exists (
        select 1
        from public.internal_social_groups g
        where g.id = audience_group_id
          and (
            g.allow_member_posts is true
            or public.current_role() in ('admin', 'rh')
            or exists (
              select 1
              from public.internal_social_group_members gm
              where gm.group_id = audience_group_id
                and gm.user_id = auth.uid()
                and gm.role in ('owner', 'moderator')
            )
          )
      )
      and exists (
        select 1
        from public.internal_social_group_members gm
        where gm.group_id = audience_group_id
          and gm.user_id = auth.uid()
      )
    )
    or public.current_role() in ('admin', 'rh')
  )
);

commit;
