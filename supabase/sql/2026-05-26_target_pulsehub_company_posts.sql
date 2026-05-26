alter table if exists public.internal_social_posts
  add column if not exists audience_company_id uuid references public.companies(id) on delete set null;

create index if not exists idx_internal_social_posts_audience_company
  on public.internal_social_posts(audience_company_id, created_at desc);

drop policy if exists internal_social_posts_select_auth on public.internal_social_posts;
create policy internal_social_posts_select_auth
on public.internal_social_posts
for select
to authenticated
using (
  public.current_role() in ('admin', 'diretoria')
  or (
    audience_type = 'company'
    and (
      audience_company_id is null
      or audience_company_id = (
        select p.company_id
        from public.profiles p
        where p.id = auth.uid()
      )
    )
  )
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
    and (
      exists (
        select 1
        from public.internal_social_groups g
        where g.id = audience_group_id
          and g.is_private = false
      )
      or exists (
        select 1
        from public.internal_social_group_members gm
        where gm.group_id = audience_group_id
          and gm.user_id = auth.uid()
      )
    )
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
    (
      audience_type = 'company'
      and (
        audience_company_id is null
        or public.current_role() in ('admin', 'diretoria', 'rh')
        or audience_company_id = (
          select p.company_id
          from public.profiles p
          where p.id = auth.uid()
        )
      )
    )
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
    )
  )
);
