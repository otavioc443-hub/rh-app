begin;

create or replace function public.rls_is_internal_social_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.internal_social_group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
  );
$$;

create or replace function public.rls_is_internal_social_group_public(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.internal_social_groups g
    where g.id = p_group_id
      and g.is_private = false
  );
$$;

grant execute on function public.rls_is_internal_social_group_member(uuid, uuid) to authenticated;
grant execute on function public.rls_is_internal_social_group_public(uuid) to authenticated;

drop policy if exists internal_social_groups_select_auth on public.internal_social_groups;
create policy internal_social_groups_select_auth
on public.internal_social_groups
for select
to authenticated
using (
  is_private = false
  or public.rls_is_internal_social_group_member(id)
  or public.current_role() in ('admin', 'diretoria')
);

drop policy if exists internal_social_group_members_select_auth on public.internal_social_group_members;
create policy internal_social_group_members_select_auth
on public.internal_social_group_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.rls_is_internal_social_group_member(group_id)
  or public.rls_is_internal_social_group_public(group_id)
  or public.current_role() in ('admin', 'diretoria')
);

commit;
